// ============================================================
//  EDIT THIS FILE ONLY to personalise the whole site.
//  Everything on the Home and About pages comes from here.
// ============================================================
window.SITE = {
  name: 'Anil Kumar Paidimukkala',
  role: 'Business Central Developer',
  tagline: 'Daily notes on issues, new features, code bits and full solutions.',
  location: 'Andhra Pradesh, India',

  // Short intro shown on the home page hero
  intro:
    'I write one post a day about real problems I hit, new platform features I try, ' +
    'small code bits worth keeping, and complete working solutions you can copy.',

  // Longer bio for the About page (paragraphs)
  about: [
    'Write a few lines about who you are and what you build.',
    'Mention the domains you work in, the kind of problems you enjoy solving, and what readers can expect here.'
  ],

  // Links shown in the hero and footer. Remove any you do not use.
  links: [
    { label: 'GitHub',   url: 'https://github.com/your-username' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/your-username' }
  ],

  // Skills grouped by area; this is the "capability" section on About
  skills: [
    { group: 'Business Central',  items: ['AL', 'Reports', 'Control Add-ins', 'APIs & Web Services', 'Permission Sets', 'PTE Extensions'] },
    { group: 'India Localization', items: ['GST Tax Engine', 'E-Invoicing', 'TDS / TCS'] },
    { group: 'AI & Cloud',        items: ['Copilot in BC', 'Azure OpenAI', 'Azure DevOps'] },
    { group: 'Web',               items: ['JavaScript', 'HTML / CSS', 'Git'] }
  ],

  // Optional: highlight projects or experience on About
  highlights: [
    { title: 'Project or role title', meta: 'Company / Year', text: 'One or two lines on what you delivered and the result.' }
  ]
};
