// ============================================================
//  EDIT THIS FILE ONLY to personalise the whole site.
//  Everything on the Home and About pages comes from here.
// ============================================================
window.SITE = {
  name: 'Anil Kumar Paidimukkala',
  role: 'Dynamics 365 Business Central Technical Consultant',
  location: 'India',

  // Shown on the home page hero
  intro:
    'I write one post a day about real Business Central problems I hit, new platform features I try, ' +
    'small AL code bits worth keeping, and complete working solutions you can copy.',

  // Shown in the hero, About page and footer. Remove any you do not want public.
  links: [
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/anilkcs001' },
    { label: 'Email',    url: 'mailto:anilkcs001@gmail.com' }
  ],

  // Your live site address, no trailing slash. Needed for the RSS feed.
  // Example: 'https://yourusername.github.io'
  siteUrl: '',

  // Email subscribe box (optional). Use any newsletter service that gives you an embed form,
  // for example Buttondown. Copy the form's "action" address here. Leave empty to hide the email box.
  subscribe: {
    action: '',        // e.g. 'https://buttondown.com/api/emails/embed-subscribe/your-username'
    emailField: 'email'
  },

  // Questions under each post (giscus = free, uses GitHub Discussions on your repo).
  // Leave repoId / categoryId empty and visitors see "Ask by email" and LinkedIn buttons instead.
  // Get the values at https://giscus.app (see POSTING-GUIDE.md, section 8).
  comments: {
    repo: '',        // e.g. 'yourusername/yourusername.github.io'
    repoId: '',      // e.g. 'R_kgDO...'
    category: 'Q&A',
    categoryId: ''   // e.g. 'DIC_kwDO...'
  },

  // ---------- About page ----------

  summary: [
    'Business Central Technical Consultant with 3+ years of hands-on experience across implementation and support projects. ' +
    'I work from requirement gathering and business process analysis through solution design, AL development, testing and production support.',
    'My functional ground covers Finance, Procurement, Purchase, Sales, Inventory, Budgeting, Fixed Assets, Approvals and India GST. ' +
    'I enjoy turning business requirements into scalable extensions, workflows, reports, integrations and automation.'
  ],

  stats: [
    { value: '3+',  label: 'years in Business Central' },
    { value: '50+', label: 'RDLC & Excel reports delivered' },
    { value: 'MB-820', label: 'Developer Associate certified' },
    { value: '2',   label: 'end-to-end projects' }
  ],

  // Key technical highlights
  highlights: [
    {
      title: 'Reusable BC frameworks',
      text: 'Built reusable frameworks for Buyer Assignment, Dynamic No. Series and Dynamic Email Templates.'
    },
    {
      title: 'SharePoint DMS + secure banking',
      text: 'Built document management with SharePoint and Microsoft Graph API, and secure bank integrations using AES/RSA encryption.'
    },
    {
      title: 'GST Rate Generator',
      text: 'Automated HSN and state-wise CGST, SGST and IGST setup for India GST.'
    },
    {
      title: 'AI Agent with Azure OpenAI',
      text: 'Built AI-assisted document processing in Business Central using Azure OpenAI and the System.AI module.'
    }
  ],

  experience: [
    {
      title: 'Business Central Technical Consultant',
      company: 'PwC India, Chennai',
      period: 'Aug 2023 – Present',
      bullets: [
        'Worked across implementation and support projects: requirement gathering, business process analysis, development, testing, troubleshooting, deployment and production support.',
        'Engaged with business stakeholders to translate Finance, Procurement, Purchase, Sales, Inventory, Budgeting and India GST requirements into Business Central solutions.',
        'Developed and customized extensions in AL using Interfaces, RecordRef/FieldRef, RecordId, Dictionary, Events, reusable frameworks and APIs.',
        'Built integrations using REST / Business Central APIs, Microsoft Graph API, SharePoint, Power Automate and Business Events.',
        'Developed RDLC and Excel-based reports for financial, MIS, operational and management requirements.',
        'Used Azure DevOps and Git for work tracking, source control, collaboration and delivery.'
      ],
      projects: [
        {
          name: 'Education Sector Implementation',
          duration: 'Current',
          bullets: [
            'Customized procurement and finance processes, including purchase requisitions, budgeting, approvals and procurement controls.',
            'Designed a configurable multi-level approval workflow for different approval scenarios.',
            'Automated notifications using email templates, Business Events and Power Automate.',
            'Built document management with SharePoint, accessible directly from Business Central pages.',
            'Delivered reusable components such as configurable number series, secure bank integration and India GST setup automation.'
          ]
        },
        {
          name: 'Manufacturing Sector Implementation',
          duration: '16 months',
          bullets: [
            'Translated business requirements into AL customizations across Sales, Purchase and Finance.',
            'Developed 50+ RDLC and Excel reports for MIS, operational, financial and year-end reporting.',
            'Automated sales processing through Excel upload, from invoice creation to settlement.',
            'Customized purchase, warehouse and posting processes, and extended dimensions for richer financial analysis.'
          ]
        }
      ]
    }
  ],

  functional: [
    'Finance & Accounting', 'General Ledger', 'Payables & Receivables', 'Procurement', 'Purchase',
    'Sales', 'Inventory', 'Budgeting', 'CAPEX / OPEX', 'Fixed Assets', 'Approvals & Workflows', 'India GST'
  ],

  skills: [
    { group: 'AL Development',
      items: ['AL / C-AL', 'Extensions', 'Tables', 'Pages', 'Codeunits', 'Interfaces', 'RecordRef / FieldRef', 'RecordId', 'Dictionary', 'Events / Event Subscribers'] },
    { group: 'Integration & APIs',
      items: ['REST APIs', 'BC APIs', 'OData', 'Microsoft Graph API', 'Business Events', 'HTTP Services', 'SharePoint', 'Power Automate', 'JSON / XML'] },
    { group: 'Reporting',
      items: ['RDLC', 'Excel Buffer'] },
    { group: 'Security',
      items: ['AES / RSA'] },
    { group: 'AI & DevOps',
      items: ['Azure OpenAI', 'System.AI', 'Azure DevOps', 'Git'] }
  ],

  certifications: [
    { title: 'Microsoft Certified: Dynamics 365 Business Central Developer Associate (MB-820)', note: 'Valid through February 2027' },
    { title: 'Career Essentials in Generative AI', note: 'Microsoft and LinkedIn' }
  ],

  education: [
    { degree: 'M.Tech. – Environmental Engineering', school: 'National Institute of Technology, Surathkal', year: '2023' }
  ],

  languages: ['English', 'Telugu', 'Hindi']
};
