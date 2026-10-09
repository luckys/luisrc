export type CurriculumLocale = 'es' | 'en'

export interface CurriculumEntry {
  title: string
  subtitle?: string
  period?: string
  body?: string
  bullets?: string[]
  technologies?: string
  links?: { label: string; href: string }[]
}

export interface CurriculumSection {
  title: string
  kind: 'summary' | 'expertise' | 'experience' | 'projects' | 'education'
  entries: CurriculumEntry[]
}

export interface CurriculumContent {
  pageTitle: string
  pageDescription: string
  eyebrow: string
  headline: string
  specialism: string
  location: string
  email: string
  downloadLabel: string
  downloadHint: string
  updated: string
  contactLabel: string
  sections: CurriculumSection[]
}

export const curriculum: Record<CurriculumLocale, CurriculumContent> = {
  en: {
    pageTitle: 'Curriculum vitae',
    pageDescription:
      'Luis Ramírez Calle — Senior Full-Stack Software Engineer and Tech Lead specializing in TypeScript, Node.js, React, PostgreSQL and AWS.',
    eyebrow: 'PROFESSIONAL PROFILE',
    headline: 'Senior Full-Stack Software Engineer / Tech Lead',
    specialism: 'TypeScript · Node.js / NestJS · React / Vue.js · PostgreSQL · AWS',
    location: 'Las Palmas de Gran Canaria, Spain',
    email: 'luis.ramirezcalle@outlook.com',
    downloadLabel: 'Download PDF',
    downloadHint: 'A PDF is generated from the content on this page.',
    updated: 'Updated October 2026',
    contactLabel: 'Contact & profiles',
    sections: [
      {
        title: 'Professional summary',
        kind: 'summary',
        entries: [
          {
            title: 'Full-stack development, product delivery and technical leadership',
            body: 'Senior Software Engineer and hands-on Tech Lead with nearly 10 years of experience building SaaS, e-commerce and logistics products. Specializes in TypeScript, Node.js, NestJS, React, Vue.js and PostgreSQL. Led a 4-person team on a platform processing approximately 1,000 orders per day and built a logistics platform handling approximately 5,000 shipments per day. Owns delivery from product decisions and architecture to automated testing, cloud deployment and production operations. Additional experience in legacy modernization, secure integrations and AI features using OpenAI API and RAG.',
          },
        ],
      },
      {
        title: 'Professional experience',
        kind: 'experience',
        entries: [
          {
            title: 'Medflow S.L.U. — Oncoviva',
            subtitle:
              'Co-Founder & Chief Technology Officer (CTO) / Senior Software Engineer (Freelance)',
            period: 'Feb 2026 — Present',
            bullets: [
              'Built Oncoviva from zero to production as the sole engineer, owning NestJS/TypeScript backend and React frontend delivery, modular architecture (DDD, Hexagonal Architecture) and technical product decisions with the CEO.',
              'Implemented authentication and authorization for sensitive data: 2FA, HttpOnly refresh tokens, PostgreSQL RLS, ownership isolation, concurrency control and replay protection.',
              'Integrated Odoo, DocuSeal and Redsys payments; implemented asynchronous background jobs with Redis and BullMQ.',
              'Established automated tests with Vitest, React Testing Library and Playwright, including PostgreSQL integration tests, HTTP contracts and Zod validation; owned Docker, CI/CD, database migrations and production monitoring with GlitchTip.',
              'Integrated AI capabilities using OpenAI API, Retrieval-Augmented Generation (RAG) and AI SDK.',
            ],
            technologies:
              'TypeScript, Node.js, NestJS, React, PostgreSQL, Redis, BullMQ, Docker, Docker Compose, GlitchTip, Redsys, CI/CD, Zod, OpenAI API, RAG, AI SDK',
          },
          {
            title: 'TALKUAL',
            subtitle: 'Chief Technology Officer (CTO) / Tech Lead',
            period: 'May 2023 — Nov 2025',
            bullets: [
              'Led a 4-person engineering team for an e-commerce platform processing approximately 1,000 orders per day, while contributing directly to product delivery.',
              'Defined architecture and product priorities with business stakeholders; refactored legacy code and addressed technical debt alongside new features.',
              'Led the Nuxt 2 to Nuxt 3 migration to improve performance and maintainability of the Vue.js frontend.',
              'Automated accounting and manufacturing workflows through Odoo integration, integrated Redsys payments and worked with Docker, GitHub Actions and GitLab CI delivery pipelines.',
            ],
            technologies:
              'TypeScript, Node.js, Vue.js, Nuxt, PostgreSQL, Odoo, Redsys, Heroku, Docker, Docker Compose, GitHub Actions, GitLab CI',
          },
          {
            title: 'Tuklo',
            subtitle: 'Full-Stack Software Engineer / Tech Lead',
            period: 'Mar 2021 — May 2023',
            bullets: [
              'Built a last-mile logistics SaaS platform from the ground up, delivering backend, frontend and AWS infrastructure for approximately 5,000 shipments per day.',
              'Implemented AWS serverless workloads with Lambda, SQS and SES, using MySQL, DynamoDB and Redis; monitored production with CloudWatch and Sentry.',
              'Integrated Cainiao, Citibox, Google Maps, Routific route optimization and Stripe payments; contributed to MoxDelivery, a SaaS home-delivery platform.',
              'Worked with Terraform (IaC), Kubernetes, Docker Compose and CI/CD pipelines using GitHub Actions and GitLab CI.',
            ],
            technologies:
              'Laravel, PHP, TypeScript, Node.js, Vue.js, Nuxt, AWS, Lambda, SQS, SES, CloudWatch, Bedrock, Serverless, Terraform, Kubernetes, Docker, Docker Compose, GitHub Actions, GitLab CI, Sentry, Stripe, Redis, DynamoDB, MySQL, GraphQL, Google Maps, Routific',
          },
          {
            title: 'Hyve Innovation Community',
            subtitle: 'Full-Stack Software Engineer',
            period: 'Jan 2017 — Feb 2021',
            bullets: [
              'Built a real-time monitoring platform for Hörmann covering approximately 200 devices across 5 warehouses.',
              'Developed full-stack products for enterprise clients, including Lenogulf (seed trading) and HYVE Crowd (crowdsourcing), using PHP/Laravel and JavaScript frameworks.',
              'Worked with AWS infrastructure and containerized development environments using Docker and Docker Compose.',
            ],
            technologies:
              'PHP, Laravel, Node.js, React, Vue.js, Nuxt, Next.js, Express, Symfony, MySQL, MongoDB, AWS, Docker, Docker Compose, Tailwind CSS',
          },
        ],
      },
      {
        title: 'Technical skills',
        kind: 'expertise',
        entries: [
          {
            title: 'Languages',
            body: 'TypeScript, JavaScript, PHP; Python (working knowledge)',
          },
          {
            title: 'Backend & APIs',
            body: 'Node.js, NestJS, Express, REST APIs, GraphQL, Laravel, Symfony, third-party integrations, asynchronous processing, background jobs (Redis, BullMQ)',
          },
          {
            title: 'Frontend',
            body: 'React (React.js), Next.js, React Router, Vue.js, Nuxt, TypeScript, Vite, Tailwind CSS',
          },
          {
            title: 'AI product engineering',
            body: 'AI agent development, Model Context Protocol (MCP), OpenAI API, Anthropic Claude integration, Retrieval-Augmented Generation (RAG), AI SDK, Large Language Model (LLM) integration, Amazon Bedrock, AI-assisted development with human review and testing',
          },
          {
            title: 'Data, architecture & security',
            body: 'SQL, PostgreSQL, MySQL, MongoDB, DynamoDB, Redis; Domain-Driven Design (DDD), Hexagonal Architecture, modular design; authentication, authorization, PostgreSQL Row-Level Security (RLS), concurrency control',
          },
          {
            title: 'Cloud infrastructure & delivery',
            body: 'Amazon Web Services (AWS): Lambda, SQS, SES, CloudWatch; serverless, Terraform (Infrastructure as Code / IaC), Docker, Docker Compose, Kubernetes, Linux, Cloudflare, Heroku; CI/CD, GitHub Actions, GitLab CI; production monitoring with Sentry and GlitchTip',
          },
          {
            title: 'Automated testing & quality',
            body: 'Test-Driven Development (TDD), Vitest, React Testing Library, Playwright; unit, integration, HTTP contract and end-to-end (E2E) testing; regression testing, legacy refactoring and framework migrations',
          },
          {
            title: 'Technical leadership',
            body: 'Hands-on team leadership, product and stakeholder collaboration, architecture decisions, technical debt prioritization, end-to-end delivery and production ownership',
          },
        ],
      },
      {
        title: 'Personal & open-source projects',
        kind: 'projects',
        entries: [
          {
            title: 'LearningHard',
            subtitle: 'Founder / Senior Software Engineer (Personal Project)',
            period: 'Nov 2025 — Present',
            bullets: [
              'Building an open-source educational platform that turns technical documentation into practical learning paths and production-like applications; own product design, architecture and implementation.',
            ],
            technologies:
              'TypeScript, Node.js, Nuxt, PostgreSQL, Docker, Docker Compose, open source',
          },
          {
            title: 'Dialoglume',
            body: 'Language-learning application for practicing everyday conversations through guided dialogues or free text, with configurable voices, role-play and shadowing modes.',
            links: [
              { label: 'Dialoglume', href: 'https://dialoglume.learninghard.dev/' },
            ],
          },
          {
            title: 'vautext-brain · agent-skills',
            body: 'Selected open-source work exploring architecture, automation and AI-assisted engineering workflows.',
            links: [
              { label: 'vautext-brain', href: 'https://github.com/luckys/vautext-brain' },
              { label: 'agent-skills', href: 'https://github.com/luckys/agent-skills' },
            ],
          },
        ],
      },
      {
        title: 'Education & languages',
        kind: 'education',
        entries: [
          {
            title: 'University of Las Palmas de Gran Canaria',
            subtitle:
              'Computer Engineering Degree, Information Technology specialization',
            period: '2012 — 2016',
          },
          {
            title: 'Continuing education: Machine Learning',
            period: 'In progress',
            body: 'Currently training in Machine Learning and data analysis with Python, pandas, NumPy, MATLAB and TensorFlow.',
          },
          {
            title: 'Languages',
            body: 'Spanish (Native) · English (Professional)',
          },
        ],
      },
    ],
  },
  es: {
    pageTitle: 'Currículum vitae',
    pageDescription:
      'Luis Ramírez Calle — Ingeniero de software full stack sénior y Tech Lead especializado en TypeScript, Node.js, React, PostgreSQL y AWS.',
    eyebrow: 'PERFIL PROFESIONAL',
    headline: 'Ingeniero de software full stack sénior / Tech Lead',
    specialism: 'TypeScript · Node.js / NestJS · React / Vue.js · PostgreSQL · AWS',
    location: 'Las Palmas de Gran Canaria, España',
    email: 'luis.ramirezcalle@outlook.com',
    downloadLabel: 'Descargar PDF',
    downloadHint: 'El PDF se genera a partir del contenido de esta página.',
    updated: 'Actualizado en octubre de 2026',
    contactLabel: 'Contacto y perfiles',
    sections: [
      {
        title: 'Perfil profesional',
        kind: 'summary',
        entries: [
          {
            title: 'Desarrollo full stack, entrega de producto y liderazgo técnico',
            body: 'Ingeniero de software sénior (Senior Software Engineer) y Tech Lead con casi 10 años de experiencia en productos SaaS, comercio electrónico y logística. Especializado en TypeScript, Node.js, NestJS, React, Vue.js y PostgreSQL. Lideré un equipo de cuatro personas en una plataforma con unos 1.000 pedidos diarios y construí una plataforma logística con unos 5.000 envíos diarios. Asumo el ciclo completo: decisiones de producto, arquitectura, pruebas automatizadas, despliegue cloud y operaciones en producción. Experiencia adicional en modernización de código heredado, integraciones seguras y funciones de IA con OpenAI API y RAG.',
          },
        ],
      },
      {
        title: 'Experiencia profesional',
        kind: 'experience',
        entries: [
          {
            title: 'Medflow S.L.U. — Oncoviva',
            subtitle:
              'Cofundador y director de tecnología (CTO) / Ingeniero de software sénior (Freelance)',
            period: 'Feb 2026 — Actualidad',
            bullets: [
              'Construí Oncoviva desde cero hasta producción como único ingeniero: backend NestJS/TypeScript, frontend React, arquitectura modular (DDD, Arquitectura Hexagonal) y decisiones técnicas de producto junto al CEO.',
              'Implementé autenticación y autorización para datos sensibles: 2FA, tokens de refresco HttpOnly, RLS en PostgreSQL, aislamiento por titularidad, control de concurrencia y protección contra repetición.',
              'Integré Odoo, DocuSeal y pagos con Redsys; implementé tareas asíncronas en segundo plano con Redis y BullMQ.',
              'Establecí pruebas automatizadas con Vitest, React Testing Library y Playwright, incluyendo integración con PostgreSQL, contratos HTTP y validación con Zod; asumí Docker, CI/CD, migraciones y monitorización en producción con GlitchTip.',
              'Integré funciones de IA con OpenAI API, generación aumentada por recuperación (RAG) y AI SDK.',
            ],
            technologies:
              'TypeScript, Node.js, NestJS, React, PostgreSQL, Redis, BullMQ, Docker, Docker Compose, GlitchTip, Redsys, CI/CD, Zod, OpenAI API, RAG, AI SDK',
          },
          {
            title: 'TALKUAL',
            subtitle: 'Director de tecnología (CTO) / Tech Lead',
            period: 'May 2023 — Nov 2025',
            bullets: [
              'Lideré un equipo de cuatro personas en una plataforma de comercio electrónico con unos 1.000 pedidos diarios, participando directamente en el desarrollo y las entregas.',
              'Definí arquitectura y prioridades de producto con negocio; refactoricé código heredado y abordé deuda técnica junto con nuevas funcionalidades.',
              'Lideré la migración de Nuxt 2 a Nuxt 3 para mejorar el rendimiento y la mantenibilidad del frontend Vue.js.',
              'Automaticé flujos de contabilidad y fabricación mediante Odoo, integré pagos con Redsys y trabajé con Docker y pipelines de entrega con GitHub Actions y GitLab CI.',
            ],
            technologies:
              'TypeScript, Node.js, Vue.js, Nuxt, PostgreSQL, Odoo, Redsys, Heroku, Docker, Docker Compose, GitHub Actions, GitLab CI',
          },
          {
            title: 'Tuklo',
            subtitle: 'Ingeniero de software full stack / Tech Lead',
            period: 'Mar 2021 — May 2023',
            bullets: [
              'Construí desde cero una plataforma SaaS de logística de última milla, con backend, frontend e infraestructura AWS para unos 5.000 envíos diarios.',
              'Implementé cargas serverless en AWS con Lambda, SQS y SES, utilizando MySQL, DynamoDB y Redis; monitoricé producción con CloudWatch y Sentry.',
              'Integré Cainiao, Citibox, Google Maps, optimización de rutas con Routific y pagos con Stripe; colaboré en MoxDelivery, una plataforma SaaS de entrega a domicilio.',
              'Trabajé con Terraform (IaC), Kubernetes, Docker Compose y pipelines de CI/CD con GitHub Actions y GitLab CI.',
            ],
            technologies:
              'Laravel, PHP, TypeScript, Node.js, Vue.js, Nuxt, AWS, Lambda, SQS, SES, CloudWatch, Bedrock, Serverless, Terraform, Kubernetes, Docker, Docker Compose, GitHub Actions, GitLab CI, Sentry, Stripe, Redis, DynamoDB, MySQL, GraphQL, Google Maps, Routific',
          },
          {
            title: 'Hyve Innovation Community',
            subtitle: 'Ingeniero de software full stack',
            period: 'Ene 2017 — Feb 2021',
            bullets: [
              'Construí una plataforma de monitorización en tiempo real para Hörmann con unos 200 dispositivos distribuidos en cinco almacenes.',
              'Desarrollé productos full stack para clientes empresariales, incluyendo Lenogulf (comercio de semillas) e HYVE Crowd (crowdsourcing), con PHP/Laravel y frameworks JavaScript.',
              'Trabajé con infraestructura AWS y entornos de desarrollo con contenedores mediante Docker y Docker Compose.',
            ],
            technologies:
              'PHP, Laravel, Node.js, React, Vue.js, Nuxt, Next.js, Express, Symfony, MySQL, MongoDB, AWS, Docker, Docker Compose, Tailwind CSS',
          },
        ],
      },
      {
        title: 'Competencias técnicas',
        kind: 'expertise',
        entries: [
          {
            title: 'Lenguajes',
            body: 'TypeScript, JavaScript, PHP; Python (conocimientos prácticos)',
          },
          {
            title: 'Backend y APIs',
            body: 'Node.js, NestJS, Express, APIs REST, GraphQL, Laravel, Symfony, integraciones con terceros, procesamiento asíncrono, tareas en segundo plano (Redis, BullMQ)',
          },
          {
            title: 'Frontend',
            body: 'React (React.js), Next.js, React Router, Vue.js, Nuxt, TypeScript, Vite, Tailwind CSS',
          },
          {
            title: 'Ingeniería de producto con IA',
            body: 'Creación de agentes de IA, Model Context Protocol (MCP), OpenAI API, integración con Claude (Anthropic), generación aumentada por recuperación (Retrieval-Augmented Generation / RAG), AI SDK, integración de modelos de lenguaje (LLM), Amazon Bedrock, desarrollo asistido por IA con revisión humana y pruebas',
          },
          {
            title: 'Datos, arquitectura y seguridad',
            body: 'SQL, PostgreSQL, MySQL, MongoDB, DynamoDB, Redis; Domain-Driven Design (DDD), Arquitectura Hexagonal, diseño modular; autenticación, autorización, Row-Level Security (RLS) en PostgreSQL, control de concurrencia',
          },
          {
            title: 'Infraestructura cloud y entrega',
            body: 'Amazon Web Services (AWS): Lambda, SQS, SES, CloudWatch; serverless, Terraform (infraestructura como código / IaC), Docker, Docker Compose, Kubernetes, Linux, Cloudflare, Heroku; CI/CD, GitHub Actions, GitLab CI; monitorización en producción con Sentry y GlitchTip',
          },
          {
            title: 'Pruebas automatizadas y calidad',
            body: 'Desarrollo guiado por pruebas (TDD), Vitest, React Testing Library, Playwright; pruebas unitarias, de integración, de contratos HTTP y de extremo a extremo (E2E); pruebas de regresión, refactoring de código heredado y migraciones de frameworks',
          },
          {
            title: 'Liderazgo técnico',
            body: 'Liderazgo de equipos con participación en desarrollo, colaboración con producto y negocio, decisiones de arquitectura, priorización de deuda técnica, entrega y responsabilidad en producción',
          },
        ],
      },
      {
        title: 'Proyectos personales y de código abierto',
        kind: 'projects',
        entries: [
          {
            title: 'LearningHard',
            subtitle: 'Fundador / Ingeniero de software sénior (proyecto personal)',
            period: 'Nov 2025 — Actualidad',
            bullets: [
              'Desarrollo una plataforma educativa de código abierto que transforma documentación técnica en itinerarios prácticos y aplicaciones similares a las de producción; asumo diseño de producto, arquitectura e implementación.',
            ],
            technologies:
              'TypeScript, Node.js, Nuxt, PostgreSQL, Docker, Docker Compose, código abierto',
          },
          {
            title: 'Dialoglume',
            body: 'Aplicación de aprendizaje de idiomas para practicar conversaciones cotidianas con diálogos guiados o texto libre, voces configurables y modos de role-play y shadowing.',
            links: [
              { label: 'Dialoglume', href: 'https://dialoglume.learninghard.dev/' },
            ],
          },
          {
            title: 'vautext-brain · agent-skills',
            body: 'Selección de proyectos de código abierto sobre arquitectura, automatización y flujos de ingeniería asistidos por IA.',
            links: [
              { label: 'vautext-brain', href: 'https://github.com/luckys/vautext-brain' },
              { label: 'agent-skills', href: 'https://github.com/luckys/agent-skills' },
            ],
          },
        ],
      },
      {
        title: 'Formación e idiomas',
        kind: 'education',
        entries: [
          {
            title: 'Universidad de Las Palmas de Gran Canaria',
            subtitle:
              'Grado en Ingeniería Informática, especialidad en Tecnologías de la Información',
            period: '2012 — 2016',
          },
          {
            title: 'Formación continua: Machine Learning',
            period: 'En curso',
            body: 'Actualmente me estoy formando en Machine Learning y análisis de datos con Python, pandas, NumPy, MATLAB y TensorFlow.',
          },
          {
            title: 'Idiomas',
            body: 'Español (nativo) · Inglés (profesional)',
          },
        ],
      },
    ],
  },
}
