---
title: Calling an API from AL: what I wish someone had told me about HttpClient and headers
date: 2026-10-24
type: solution
tags: AL, API, HttpClient, Integration, Business Central
summary: Request, response, headers, content... When I started with integrations, these words confused me more than the code. Here is how I understand them now, with GET, POST and PATCH examples in AL you can try today.
---

When I started working on integrations in Business Central, the code was not the hard part. The words were. Client, request, response, headers, content headers, body... Everyone used them as if they were obvious. They were not obvious to me.

So in this post I want to explain them the way I finally understood them, and then show the AL code. If you are new to APIs, I hope this saves you a few hours.

## First, what is an API call?

I like to think of a restaurant.

You sit at the table. You are the **client**. The kitchen is the **server**. You don't walk into the kitchen yourself. You tell the **waiter** what you want, the waiter takes it to the kitchen, and comes back with your food.

That's really all an API call is. Business Central is sitting at the table, the other system (a payment gateway, an e-invoice portal, a courier service) is the kitchen, and in AL the waiter is called **HttpClient**.

What you tell the waiter is the **request**. What comes back is the **response**.

## What goes into a request?

Now imagine you are sending a parcel instead. To send a parcel, you need four things:

1. **What you want done.** Deliver it? Return it? This is the **method**: `GET`, `POST`, `PUT`, `PATCH` or `DELETE`.
2. **The address.** This is the **URL**, for example `https://api.example.com/orders/1001`.
3. **Labels on the box.** "Fragile", "This side up", who sent it. These are the **headers**.
4. **What's inside the box.** This is the **body**, usually some JSON.

The methods are easier than they sound:

- `GET` = give me something
- `POST` = create something new
- `PUT` = replace it completely
- `PATCH` = change just a few fields
- `DELETE` = remove it

`GET` and `DELETE` usually don't have a body. The others do.

Here is something that helped me a lot. When you send a POST, this is literally the text that travels over the internet:

```text
POST /posts HTTP/1.1
Host: jsonplaceholder.typicode.com
Content-Type: application/json
Accept: application/json

{"title":"Hello from Business Central","userId":1}
```

First line: method and address. Then the headers, one per line. Then an empty line. Then the body. That's it. When I saw this for the first time, APIs stopped feeling like magic.

## What comes back?

The response also has a simple shape:

- a **status code** that tells you if it worked,
- some **headers** about the answer,
- and a **body** with the data.

For status codes, I only remember the first digit:

| Starts with | What it means |
|-------------|---------------|
| **2** | It worked. `200` OK, `201` Created |
| **4** | **I** did something wrong. `400` bad request, `401` not logged in, `404` not found, `415` wrong content type |
| **5** | **They** have a problem. `500` server error, `503` not available |

So when I see a `4xx`, I check my own request first: the URL, the headers, the body, the key. When I see a `5xx`, it's usually not my fault, and I try again later or talk to the API owner.

## Headers: the part that confused me the most

Headers are just labels. A few you will see all the time:

- `Content-Type`: "the body I'm sending is JSON" (`application/json`)
- `Accept`: "please answer me in JSON"
- `Authorization` or something like `X-Api-Key`: "here is my token or my key"

Now the tricky part, and honestly this is where I got stuck at the start. In AL there are **two places** to put headers:

- **Request headers** are about the request itself: `Accept`, `Authorization`, API keys.
- **Content headers** are about the body: mainly `Content-Type`.

If you put `Content-Type` on the request instead of the content, AL complains. If you forget it completely, Business Central quietly sends `text/plain; charset=utf-8`, and the server answers with `415 Unsupported Media Type`. If you ever see a 415, check this first.

## The AL types, in plain words

Once the parcel picture is clear, the AL types make sense:

- `HttpClient` is the waiter. It sends the request and waits for the answer.
- `HttpRequestMessage` is the order slip: method, URL, request headers and content.
- `HttpContent` is what's inside the box, together with its own label (`Content-Type`).
- `HttpHeaders` is a list of labels.
- `HttpResponseMessage` is what comes back: status code, headers and body.

Enough theory. Let's write some code.

## Let's try a GET

For testing I use **JSONPlaceholder**. It's a free fake API, so you don't need an account or a key. If you call `https://jsonplaceholder.typicode.com/todos/1`, it answers:

```json
{ "userId": 1, "id": 1, "title": "delectus aut autem", "completed": false }
```

Here is the code:

```al
codeunit 50160 "ABC Http Demo"
{
    var
        TodoUrlTok: Label 'https://jsonplaceholder.typicode.com/todos/1', Locked = true;
        PostsUrlTok: Label 'https://jsonplaceholder.typicode.com/posts', Locked = true;
        PostUrlTok: Label 'https://jsonplaceholder.typicode.com/posts/1', Locked = true;
        CallFailedErr: Label 'The service could not be reached. Check the URL and your network.';
        StatusErr: Label 'The service returned %1 %2.', Comment = '%1 = status code, %2 = reason';

    procedure GetTodo()
    var
        Client: HttpClient;
        Response: HttpResponseMessage;
        ResponseText: Text;
        TodoJson: JsonObject;
        TitleToken: JsonToken;
    begin
        // 1. Send the request. False means the call itself failed (no answer at all)
        if not Client.Get(TodoUrlTok, Response) then
            Error(CallFailedErr);

        // 2. An answer came back. Check whether it is a success (2xx)
        if not Response.IsSuccessStatusCode() then
            Error(StatusErr, Response.HttpStatusCode(), Response.ReasonPhrase());

        // 3. Read the body as text, then as JSON
        Response.Content().ReadAs(ResponseText);
        TodoJson.ReadFrom(ResponseText);

        TodoJson.Get('title', TitleToken);
        Message('Title: %1', TitleToken.AsValue().AsText());
    end;
}
```

You should see `Title: delectus aut autem`.

One thing I want you to notice: there are **two checks**, and you need both. `Client.Get` returns `false` only when there was no answer at all, like a wrong address or no network. A `404` or `500` is still an answer, so `Get` happily returns `true`. I've seen code that only checks the first one and then wonders why it reads an error page as if it were data. That's why `IsSuccessStatusCode()` is there.

## Now a POST, sending JSON

To create something, we need a body, and we need the `Content-Type` label on the **content**. Add this procedure to the same codeunit:

```al
    procedure CreatePost()
    var
        Client: HttpClient;
        Content: HttpContent;
        ContentHeaders: HttpHeaders;
        Response: HttpResponseMessage;
        Body: JsonObject;
        BodyText: Text;
        ResponseText: Text;
    begin
        // 1. Build the body
        Body.Add('title', 'Hello from Business Central');
        Body.Add('userId', 1);
        Body.WriteTo(BodyText);

        // 2. Put the body in the content, and set the content header
        Content.WriteFrom(BodyText);
        Content.GetHeaders(ContentHeaders);
        if ContentHeaders.Contains('Content-Type') then
            ContentHeaders.Remove('Content-Type');
        ContentHeaders.Add('Content-Type', 'application/json');

        // 3. Send it
        if not Client.Post(PostsUrlTok, Content, Response) then
            Error(CallFailedErr);

        if not Response.IsSuccessStatusCode() then
            Error(StatusErr, Response.HttpStatusCode(), Response.ReasonPhrase());

        Response.Content().ReadAs(ResponseText);
        Message('Status %1: %2', Response.HttpStatusCode(), ResponseText);
    end;
```

You get status `201` (Created), and JSONPlaceholder sends your data back with a new `id` of `101`. Don't worry, nothing is really saved. It's a test API.

You might ask: why `Remove` before `Add`? Because the content already comes with `Content-Type: text/plain`. A header can hold more than one value, so if you only `Add`, you might send two content types. Removing first keeps it clean.

## When you need full control: PATCH with HttpRequestMessage

`Get`, `Post`, `Put` and `Delete` are shortcuts, and most of the time they are enough. But sometimes you need more: a `PATCH`, extra request headers, or a shorter timeout. Then I build the request myself and use `Send`:

```al
    procedure UpdatePostTitle()
    var
        Client: HttpClient;
        Request: HttpRequestMessage;
        RequestHeaders: HttpHeaders;
        Content: HttpContent;
        ContentHeaders: HttpHeaders;
        Response: HttpResponseMessage;
        ResponseText: Text;
    begin
        // The body: only the field we want to change
        Content.WriteFrom('{"title":"Updated from Business Central"}');
        Content.GetHeaders(ContentHeaders);
        if ContentHeaders.Contains('Content-Type') then
            ContentHeaders.Remove('Content-Type');
        ContentHeaders.Add('Content-Type', 'application/json');

        // The order slip: method, address, request headers, content
        Request.Method := 'PATCH';
        Request.SetRequestUri(PostUrlTok);
        Request.GetHeaders(RequestHeaders);
        RequestHeaders.Add('Accept', 'application/json');
        Request.Content := Content;

        // Wait at most 30 seconds (the default is 100 seconds)
        Client.Timeout := 30000;

        if not Client.Send(Request, Response) then
            Error(CallFailedErr);

        if not Response.IsSuccessStatusCode() then
            Error(StatusErr, Response.HttpStatusCode(), Response.ReasonPhrase());

        Response.Content().ReadAs(ResponseText);
        Message('%1', ResponseText);
    end;
```

If you read it slowly, it's the parcel again. First the content, with its own label. Then the order slip: method, address, other labels. Then the waiter takes it.

## What about the API key?

Almost every real API needs a key or a token, and it goes in a **request header**. Please don't write the key in your code. I covered this in my [Isolated Storage post](#/post/2026-10-19-isolated-storage-secrets-masked): store it there, read it as `SecretText`, and pass it like this:

```al
RequestHeaders.Add('X-Api-Key', ApiKey); // ApiKey is a SecretText read from Isolated Storage
```

The header name changes from API to API (`Authorization`, `X-Api-Key`, `api-key`...), so always check their documentation.

## Errors I keep seeing

These are the ones I'd check first:

| You see | Usually because | Try this |
|---------|-----------------|----------|
| `415 Unsupported Media Type` | `Content-Type` was never set, so `text/plain` went out | Set it on the **content** headers |
| An error when adding `Content-Type` | It was added to the request headers | Use `Content.GetHeaders`, not `Request.GetHeaders` |
| `401 Unauthorized` | The key or token is missing, wrong or expired | Check the header name and the value |
| `400 Bad Request` | The body isn't what the API expects | Compare your JSON with their example, field by field |
| `Client.Get` returns `false` | Wrong URL, no network, or the call was blocked | In a sandbox or a copied environment, check **Allow HttpClient Requests** in the extension settings |
| It takes forever | The server is slow | Set `Client.Timeout`. The default is 100 seconds |

## To sum it up

If you remember only a few things from this post, let it be these:

- An API call is just an order. `HttpClient` is the waiter: it sends a **request** and brings back a **response**.
- A request has a method, a URL, headers and (sometimes) a body.
- `2xx` means it worked, `4xx` means check your side, `5xx` means check theirs.
- `Accept` and keys go on the **request**. `Content-Type` goes on the **content**.
- Always check both: did the call happen, and did it succeed.

Next, I want to put a few of my posts together: read the key from Isolated Storage, call a real API, and save the request and response in the colourful JSON log viewer. If you'd like that, let me know in the comments.
