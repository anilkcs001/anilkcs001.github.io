// ============================================================
//  EDIT THIS FILE ONLY to personalise the whole site.
//  Everything on the Home and About pages comes from here.
// ============================================================
window.SITE = {
  name: 'Anil Kumar Paidimukkala',
  role: 'Dynamics 365 Business Central Technical Consultant',
  location: 'Chennai, India',

  // Shown on the home page hero
  intro:
    'I write a few posts a week about real Business Central problems I hit, new platform features I try, ' +
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
  repo: 'anilkcs001/anilkcs001.github.io',
  repoId: 'R_kgDOVPCHjQ',
  category: 'Q&A',
  categoryId: 'DIC_kwDOVPCHjc4DJq1g'
},
  // ---------- Visitor counter (GoatCounter, free, no cookies) ----------
  // Sign up at https://www.goatcounter.com, pick a code (for example "anilkcs001"),
  // and put that code here. Leave it empty to turn counting off.
  // Your stats are then at https://<code>.goatcounter.com
  goatcounter: 'anilkcs001',

  // ---------- About page ----------

  // Your CV for the "View CV" buttons (home and About). It opens in the browser. Put the PDF in the /files folder.
  // Leave url empty to hide the buttons.
  resume: {
    url: 'files/Anil-Kumar-Paidimukkala-BC-Technical-Consultant.pdf',
    label: 'View CV'
  },

  summary: [
    'Dynamics 365 Business Central Technical Consultant with 3+ years delivering end-to-end BC solutions across ' +
    'Manufacturing, Education and Finance Integration. I build extensions, approval workflows, posting logic, 50+ reports ' +
    'and secure integrations (OData V4, REST, OAuth 2.0, SharePoint, callbacks).',
    'I work from requirement gathering and solution design through AL development, testing, deployment, upgrades and ' +
    'production support. My functional ground covers Purchase, Sales, General Ledger, Inventory and Lot Tracking, ' +
    'Dimensions, Fixed Assets, Budgeting, Approvals, and India GST and TDS.'
  ],

  stats: [
    { value: '3+',     label: 'years in Business Central' },
    { value: '4',      label: 'client projects' },
    { value: '50+',    label: 'RDLC, Word & Excel reports' },
    { value: 'MB-820', label: 'Developer Associate certified' }
  ],

  // Key technical highlights
  highlights: [
    {
      title: 'Custom approval workflow',
      text: 'Multi-level, sequential, parallel, mandatory and minimum-group approvals in AL, so every document reaches the right approvers in the right order.'
    },
    {
      title: 'Integration with callbacks',
      text: 'OData V4 and $batch with OAuth 2.0, staging and validation, POSTED / FAILED callbacks and exponential back-off retry, so no failure is lost.'
    },
    {
      title: 'SharePoint FactBox',
      text: 'Upload from a BC page to SharePoint through Microsoft Graph API and link it to the record, so users reach documents without leaving Business Central.'
    },
    {
      title: 'Secure banking integration',
      text: 'AES for the data and RSA for the AES key, so bank data stays protected end to end.'
    },
    {
      title: 'GST Rate Generator',
      text: 'Creates every missing CGST, SGST and IGST rate line on the Tax Engine automatically, removing manual GST setup.'
    },
    {
      title: 'Fermentation module',
      text: 'Blocks each lot while it ferments, then converts it to the fermented item after a holding period through an Item Reclassification journal.'
    },
    {
      title: 'Dynamic Email Templates',
      text: 'Own templates with placeholders for record data, triggered from standard events and reusable across processes.'
    },
    {
      title: 'AI agent with Azure OpenAI',
      text: 'AI-assisted invoice processing in Business Central using Azure OpenAI and the System.AI module.'
    }
  ],

  experience: [
    {
      title: 'Business Central Technical Consultant',
      company: 'PwC India, Chennai',
      period: 'Aug 2023 – Present',
      bullets: [
        'Delivered end-to-end AL solutions: design, development, testing, deployment, upgrades and support.',
        'Extended standard behavior with events, subscribers, interfaces, RecordRef/FieldRef and reusable frameworks.',
        'Implemented posting and finance logic: Purchase, Sales and G/L posting, item charge assignment, dimensions, India GST and TDS.',
        'Developed integrations and 50+ reports: API and web service integrations; RDLC, Word and Excel reports.',
        'Ensured quality: debugging, code reviews, performance tuning and design documents, with Git and Azure DevOps.'
      ],
      projects: [
        {
          name: 'Finance Integration Project (Logistics)',
          duration: 'Sep 2026 – Present',
          bullets: [
            'Built the inbound integration: an external TMS sends Customer, Vendor, AP and AR data through OData V4 (single-record and $batch) with OAuth 2.0 into staging tables that are validated and posted. 100 vendors are checked and created in about 7 seconds.',
            'Implemented the posting callback: BC sends POSTED / FAILED with document number, batch and status message; failures go first and a posting is never sent twice.',
            'Designed error handling: errors are checked once up front, failed records are corrected and re-uploaded, and retry with exponential back-off covers 429, 500 and timeouts. A job queue every 5 minutes posts 100 records in about a minute.',
            'Tested parallel API calls (500 records in about 10 seconds), integrated the Payment Receipt API and wrote the integration guides.'
          ]
        },
        {
          name: 'Food Manufacturing Implementation',
          duration: 'Current',
          bullets: [
            'Developed the fermentation module: a Fermentation Card per lot blocks the lot while it ferments, then converts the unfermented item to the fermented item after a configurable holding period through an Item Reclassification journal, keeping lot, location, quantity and unit of measure.',
            'Built the Item Requisition module: users request new items, route them for approval, and the Item is created automatically on approval. Added Excel import and fixed duplicate numbers for concurrent users.'
          ]
        },
        {
          name: 'Education Sector Implementation and Support',
          duration: 'Jan 2025 – Present',
          bullets: [
            'Implemented procurement and budgeting: Purchase Requisitions, Buyer Assignment, CAPEX/OPEX budgeting, and invoice posting that routes capital purchases to Fixed Assets and consumables to expenses.',
            'Built a fully customized approval workflow with Dynamic Email Templates and Power Automate / Teams notifications.',
            'Delivered GST (CGST, SGST, IGST, Cess) and TDS totals on the Purchase Order subform with Page Background Tasks, and a "By Amount to Receive" item charge assignment.',
            'Integrated a reusable SharePoint FactBox, secure bank integration with AES and RSA, an Azure OpenAI invoice agent, Dynamic No. Series and the GST Rate Generator.'
          ]
        },
        {
          name: 'Tea Industry Implementation and Support',
          duration: 'Dec 2023 – Mar 2025',
          bullets: [
            'Automated sales: users upload an Excel file and the system creates Sales Invoices and handles settlement and distribution across brokers.',
            'Delivered RDLC and Excel reports (MIS, operational, financial, payroll and year-end) for manufacturing and sorting operations.',
            'Integrated GST e-invoicing with ClearTax for tax compliance.',
            'Customized purchase invoice and posting processes, and extended dimensions from 8 to 13.'
          ]
        }
      ]
    }
  ],

  functional: [
    'Purchase', 'Sales', 'General Ledger', 'Payables & Receivables', 'Item Journals & Lot Tracking',
    'Dimensions', 'Fixed Assets', 'Budgeting', 'CAPEX / OPEX', 'Approval Workflows', 'India GST', 'India TDS'
  ],

  skills: [
    { group: 'AL Development',
      items: ['BC Architecture', 'Extensions (PTE)', 'Tables', 'Pages', 'Codeunits', 'Reports', 'Queries', 'XMLports',
              'Interfaces', 'Enums', 'Events & Subscribers', 'Page Background Tasks', 'RecordRef / FieldRef', 'Permission Sets'] },
    { group: 'Integrations',
      items: ['REST', 'JSON', 'OData V4', '$batch', 'API Pages', 'Web Services', 'OAuth 2.0', 'Retry & Error Handling',
              'Job Queue', 'SOAP', 'Microsoft Graph', 'SharePoint', 'Power Automate', 'Business Events'] },
    { group: 'Reporting',
      items: ['RDLC', 'Word Layouts', 'Excel Buffer', 'MIS Reports'] },
    { group: 'AI & Security',
      items: ['Azure OpenAI', 'System.AI', 'AI Agents', 'AES / RSA', 'Isolated Storage', 'SecretText'] },
    { group: 'Tools & Quality',
      items: ['VS Code', 'Git', 'Azure DevOps', 'Debugging', 'Performance (SetLoadFields, SIFT)', 'Code Review',
              'Unit Testing', 'Technical Design Documents', 'Upgrades', 'Production Support'] }
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
