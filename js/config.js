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
    { value: '30+', label: 'RDLC & Excel reports delivered' },
    { value: 'MB-820', label: 'Developer Associate certified' },
    { value: '2',   label: 'major client projects' }
  ],

  // Key technical highlights
  highlights: [
    {
      title: 'Reusable BC frameworks',
      text: 'Built reusable frameworks for Buyer Assignment, Dynamic No. Series and Dynamic Email Templates.'
    },
    {
      title: 'SharePoint DMS + secure banking',
      text: 'Implemented SharePoint document management using Microsoft Graph API, and secure Bank Integration using AES/RSA encryption and decryption.'
    },
    {
      title: 'GST Rate Generator',
      text: 'Automated HSN and state-wise CGST, SGST and IGST setup for India GST.'
    },
    {
      title: 'AI Agent with Azure OpenAI',
      text: 'Developed an AI Agent using Azure OpenAI and System.AI for invoice data extraction and item matching.'
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
          name: 'Education Sector',
          duration: 'Current',
          bullets: [
            'Customized Purchase and Finance processes: Purchase Requisitions, Buyer Assignment, CAPEX/OPEX Budgeting, utilization, approvals and procurement controls.',
            'Customized Purchase Invoicing for capital purchases through Fixed Assets and consumables through expenses, based on procurement type.',
            'Designed an Approval Workflow supporting multi-level, sequential, parallel, mandatory and minimum-group approval scenarios.',
            'Integrated Dynamic Email Templates, Business Events and Power Automate / Teams to streamline approvals and notifications.',
            'Implemented SharePoint DMS with a reusable FactBox for document upload, setup-driven folder mapping and document access from BC pages.',
            'Delivered the AI Agent (Azure OpenAI / System.AI), Buyer Assignment Matrix, Dynamic No. Series, secure Bank Integration (AES/RSA) and GST Rate Generator.'
          ]
        },
        {
          name: 'Tea Industry',
          duration: '16 months',
          bullets: [
            'Converted Tea Industry requirements into AL customizations across Sales, Purchase and Finance processes.',
            'Developed 30+ complex RDLC and Excel reports covering MIS, operational, financial and year-end reporting across Tea Manufacturing, Sorting, Payroll and Warehouse.',
            'Automated Tea Board sales processing through Excel upload, Sales Invoice creation and settlement and distribution across warehouses, brokers and Tea Board transactions.',
            'Customized Purchase Invoice, warehouse and posting processes, and extended Business Central dimensions from 8 to 13 for richer financial and operational analysis.'
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
