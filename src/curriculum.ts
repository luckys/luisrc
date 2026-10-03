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
  kind: 'summary' | 'expertise' | 'experience' | 'projects' | 'approach' | 'education'
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
      'Professional background, selected work and engineering approach of Luis Ramírez Calle.',
    eyebrow: 'PROFESSIONAL PROFILE',
    headline: 'Senior Software Engineer',
    specialism: 'TypeScript / Node.js · SaaS, Platform & AI Engineering',
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
            title: 'SaaS, platform & AI engineering',
            body: 'Senior Software Engineer with nearly 10 years of experience designing, building and evolving SaaS, e-commerce, logistics and business-critical products. Hands-on technical leader who has taken products from zero to production, led engineering teams and owned architecture, implementation, testing, security, integrations, cloud delivery and operations. Deep experience with TypeScript, Node.js, React, Vue/Nuxt and PostgreSQL, supported by DDD, Hexagonal Architecture, secure data-isolation patterns and asynchronous processing. Practical experience integrating AI capabilities into products with OpenAI API, RAG and AI SDK, plus working knowledge of Python for AI and automation workflows.',
          },
        ],
      },
      {
        title: 'Core expertise',
        kind: 'expertise',
        entries: [
          {
            title: 'Languages',
            body: 'TypeScript, JavaScript, Python (working knowledge), PHP',
          },
          {
            title: 'Backend & APIs',
            body: 'Node.js, NestJS, Express, Laravel, Symfony, REST APIs, asynchronous processing, BullMQ',
          },
          {
            title: 'Frontend',
            body: 'React, React Router, Vue.js, Nuxt, Vite, Tailwind CSS',
          },
          {
            title: 'AI product engineering',
            body: 'OpenAI API, RAG, AI SDK, LLM integration, AI-assisted engineering workflows',
          },
          {
            title: 'Data, architecture & security',
            body: 'PostgreSQL, MySQL, MongoDB, DynamoDB, Redis, DDD, Hexagonal Architecture, bounded contexts, PostgreSQL RLS, fail-closed authorization, concurrency control',
          },
          {
            title: 'Cloud, delivery & quality',
            body: 'AWS, Serverless, Docker, Cloudflare, Linux, CI/CD, TDD, Vitest, React Testing Library, Playwright, integration and contract testing',
          },
          {
            title: 'Technical leadership',
            body: 'End-to-end ownership, product collaboration, architecture decisions, team leadership, pragmatic engineering and production operations',
          },
        ],
      },
      {
        title: 'Professional experience',
        kind: 'experience',
        entries: [
          {
            title: 'Medflow S.L.U. — Oncoviva',
            subtitle: 'Co-Founder & CTO / Senior Software Engineer / Freelance',
            period: 'Feb 2026 — Present',
            bullets: [
              'Built Oncoviva from the ground up as the sole engineer, owning architecture, backend and frontend implementation, deployment, operations and technical product decisions with the CEO.',
              'Designed a modular architecture using Domain-Driven Design, Hexagonal Architecture and bounded contexts, with NestJS/TypeScript on the backend and React/TypeScript on the frontend.',
              'Engineered security controls for sensitive data, including 2FA, HttpOnly refresh tokens, PostgreSQL RLS, actor and ownership isolation, fail-closed authorization, atomic locking, concurrency control and replay protection.',
              'Built integrations with Odoo, DocuSeal and Redsys plus asynchronous workflows with Redis and BullMQ; established reproducible migrations, Docker/pnpm delivery and CI/CD.',
              'Established automated quality gates with TDD, Vitest, React Testing Library, Playwright, PostgreSQL integration tests, HTTP contracts and Zod, and integrated AI capabilities using OpenAI API, RAG and AI SDK.',
            ],
            technologies:
              'TypeScript, Node.js, NestJS, React, PostgreSQL, Redis, BullMQ, Docker, CI/CD, Zod, OpenAI API, RAG, AI SDK',
          },
          {
            title: 'LearningHard',
            subtitle: 'Founder / Senior Software Engineer (Personal Project)',
            period: 'Nov 2025 — Present',
            bullets: [
              'Building an open-source educational platform that converts technical documentation into practical learning paths and production-like applications.',
              'Own product design and implementation, applying use-case-driven architecture, maintainable code and pragmatic software-engineering practices.',
            ],
            technologies: 'TypeScript, Node.js, Nuxt, PostgreSQL, open source',
          },
          {
            title: 'TALKUAL',
            subtitle: 'CTO / Tech Lead',
            period: 'May 2023 — Nov 2025',
            bullets: [
              'Led technology and product engineering for an e-commerce platform processing approximately 1,000 orders per day, managing a 4-person team while remaining hands-on in delivery.',
              'Defined architecture, technology strategy and product priorities with business stakeholders, balancing short-term delivery with long-term platform evolution.',
              'Refactored legacy code to improve maintainability and code quality.',
              'Led the Nuxt 2 to Nuxt 3 migration, improving performance, maintainability and access to the modern Vue/Nuxt ecosystem.',
              'Integrated Odoo to automate accounting and manufacturing workflows tied to the order lifecycle.',
            ],
            technologies: 'TypeScript, Node.js, Vue.js, Nuxt, PostgreSQL, Odoo, Heroku',
          },
          {
            title: 'Tuklo',
            subtitle: 'Full-Stack Software Engineer / Tech Lead',
            period: 'Mar 2021 — May 2023',
            bullets: [
              'Designed and built a last-mile SaaS platform from the ground up across backend, frontend, cloud infrastructure and external integrations.',
              'Delivered a system handling approximately 5,000 shipments per day, including integrations with Cainiao and Citibox.',
              'Implemented AWS Serverless architecture, Google Maps geolocation and route optimization with Routific; also contributed to MoxDelivery, a SaaS home-delivery platform.',
            ],
            technologies:
              'Laravel, PHP, TypeScript, Node.js, Vue.js, Nuxt, AWS, Serverless, Redis, DynamoDB, MySQL, GraphQL, Google Maps, Routific, Docker',
          },
          {
            title: 'Hyve Innovation Community',
            subtitle: 'Full-Stack Software Engineer',
            period: 'Jan 2017 — Feb 2021',
            bullets: [
              'Designed and developed backend and frontend systems for products across multiple industries and enterprise clients.',
              'For Hörmann, built a real-time monitoring platform for approximately 200 devices distributed across 5 warehouses.',
              'Delivered additional products including Lenogulf, a seed-trading platform, and HYVE Crowd, a crowdsourcing platform.',
            ],
            technologies:
              'PHP, Laravel, Node.js, React, Vue.js, Nuxt, Next.js, Express, Symfony, MySQL, MongoDB, Docker, Tailwind CSS',
          },
        ],
      },
      {
        title: 'Open-source projects',
        kind: 'projects',
        entries: [
          {
            title: 'nuxt-laravelize · vautext-brain · agent-skills',
            body: 'Selected open-source work exploring architecture, automation and AI-assisted engineering workflows.',
            links: [
              {
                label: 'nuxt-laravelize',
                href: 'https://github.com/luckys/nuxt-laravelize',
              },
              { label: 'vautext-brain', href: 'https://github.com/luckys/vautext-brain' },
              { label: 'agent-skills', href: 'https://github.com/luckys/agent-skills' },
            ],
          },
        ],
      },
      {
        title: 'Engineering approach',
        kind: 'approach',
        entries: [
          {
            title: 'Pragmatic architecture',
            body: 'Apply Domain-Driven Design and Hexagonal Architecture when domain complexity justifies them; prefer simple designs when it does not.',
          },
          {
            title: 'End-to-end ownership',
            body: 'Connect product decisions with architecture, implementation, testing, delivery and production operations.',
          },
          {
            title: 'Security and verifiable quality',
            body: 'Favor explicit contracts, fail-closed authorization, reproducible delivery and automated integration/E2E testing.',
          },
          {
            title: 'AI as engineering leverage',
            body: 'Use AI tooling to accelerate repetitive work, exploration and product integration while retaining engineering judgment for architecture, correctness and security.',
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
      'Trayectoria profesional, proyectos destacados y enfoque de ingeniería de Luis Ramírez Calle.',
    eyebrow: 'PERFIL PROFESIONAL',
    headline: 'Ingeniero de software sénior',
    specialism: 'TypeScript / Node.js · SaaS, plataformas e ingeniería de IA',
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
            title: 'Ingeniería SaaS, plataformas e IA',
            body: 'Ingeniero de software sénior con casi 10 años de experiencia diseñando, construyendo y evolucionando productos SaaS, de comercio electrónico, logística y misión crítica. Líder técnico práctico que ha llevado productos desde cero hasta producción, ha liderado equipos de ingeniería y ha asumido la responsabilidad de arquitectura, implementación, pruebas, seguridad, integraciones, despliegue en la nube y operaciones. Amplia experiencia con TypeScript, Node.js, React, Vue/Nuxt y PostgreSQL, respaldada por DDD, Arquitectura Hexagonal, patrones seguros de aislamiento de datos y procesamiento asíncrono. Experiencia práctica integrando capacidades de IA con OpenAI API, RAG y AI SDK, además de conocimientos de Python aplicados a flujos de IA y automatización.',
          },
        ],
      },
      {
        title: 'Áreas de especialización',
        kind: 'expertise',
        entries: [
          {
            title: 'Lenguajes',
            body: 'TypeScript, JavaScript, Python (conocimientos prácticos), PHP',
          },
          {
            title: 'Backend y APIs',
            body: 'Node.js, NestJS, Express, Laravel, Symfony, APIs REST, procesamiento asíncrono, BullMQ',
          },
          {
            title: 'Frontend',
            body: 'React, React Router, Vue.js, Nuxt, Vite, Tailwind CSS',
          },
          {
            title: 'Ingeniería de producto con IA',
            body: 'OpenAI API, RAG, AI SDK, integración de LLM, flujos de ingeniería asistidos por IA',
          },
          {
            title: 'Datos, arquitectura y seguridad',
            body: 'PostgreSQL, MySQL, MongoDB, DynamoDB, Redis, DDD, Arquitectura Hexagonal, contextos delimitados, RLS en PostgreSQL, autorización segura ante fallos, control de concurrencia',
          },
          {
            title: 'Nube, entrega y calidad',
            body: 'AWS, Serverless, Docker, Cloudflare, Linux, CI/CD, TDD, Vitest, React Testing Library, Playwright, pruebas de integración y contratos',
          },
          {
            title: 'Liderazgo técnico',
            body: 'Responsabilidad de extremo a extremo, colaboración con producto, decisiones de arquitectura, liderazgo de equipos, ingeniería pragmática y operaciones en producción',
          },
        ],
      },
      {
        title: 'Experiencia profesional',
        kind: 'experience',
        entries: [
          {
            title: 'Medflow S.L.U. — Oncoviva',
            subtitle: 'Cofundador y CTO / Ingeniero de software sénior / Freelance',
            period: 'Feb 2026 — Actualidad',
            bullets: [
              'Construí Oncoviva desde cero como único ingeniero, haciéndome cargo de la arquitectura, el desarrollo backend y frontend, el despliegue, las operaciones y las decisiones técnicas de producto junto al CEO.',
              'Diseñé una arquitectura modular con Domain-Driven Design, Arquitectura Hexagonal y contextos delimitados, con NestJS/TypeScript en backend y React/TypeScript en frontend.',
              'Desarrollé controles de seguridad para datos sensibles: 2FA, tokens de refresco HttpOnly, RLS en PostgreSQL, aislamiento por actor y titularidad, autorización segura ante fallos, bloqueos atómicos, control de concurrencia y protección contra repetición.',
              'Desarrollé integraciones con Odoo, DocuSeal y Redsys, además de flujos asíncronos con Redis y BullMQ; establecí migraciones reproducibles, entrega con Docker/pnpm y CI/CD.',
              'Establecí controles automatizados de calidad con TDD, Vitest, React Testing Library, Playwright, pruebas de integración con PostgreSQL, contratos HTTP y Zod; integré capacidades de IA mediante OpenAI API, RAG y AI SDK.',
            ],
            technologies:
              'TypeScript, Node.js, NestJS, React, PostgreSQL, Redis, BullMQ, Docker, CI/CD, Zod, OpenAI API, RAG, AI SDK',
          },
          {
            title: 'LearningHard',
            subtitle: 'Fundador / Ingeniero de software sénior (proyecto personal)',
            period: 'Nov 2025 — Actualidad',
            bullets: [
              'Desarrollo una plataforma educativa de código abierto que transforma documentación técnica en itinerarios prácticos de aprendizaje y aplicaciones similares a las de producción.',
              'Lidero el diseño e implementación del producto, aplicando arquitectura orientada a casos de uso, código mantenible y prácticas pragmáticas de ingeniería de software.',
            ],
            technologies: 'TypeScript, Node.js, Nuxt, PostgreSQL, código abierto',
          },
          {
            title: 'TALKUAL',
            subtitle: 'CTO / Tech Lead',
            period: 'May 2023 — Nov 2025',
            bullets: [
              'Lideré la tecnología y la ingeniería de producto de una plataforma de comercio electrónico que procesaba aproximadamente 1.000 pedidos diarios. Gestioné un equipo de cuatro personas y participé activamente en las entregas.',
              'Definí la arquitectura, la estrategia tecnológica y las prioridades de producto con las partes interesadas del negocio, equilibrando las entregas a corto plazo con la evolución de la plataforma.',
              'Refactoricé código heredado para mejorar su mantenibilidad y calidad.',
              'Lideré la migración de Nuxt 2 a Nuxt 3, mejorando el rendimiento y la mantenibilidad, y facilitando la adopción del ecosistema moderno de Vue/Nuxt.',
              'Integré Odoo para automatizar flujos de contabilidad y fabricación vinculados al ciclo de vida de los pedidos.',
            ],
            technologies: 'TypeScript, Node.js, Vue.js, Nuxt, PostgreSQL, Odoo, Heroku',
          },
          {
            title: 'Tuklo',
            subtitle: 'Ingeniero de software full stack / Tech Lead',
            period: 'Mar 2021 — May 2023',
            bullets: [
              'Diseñé y construí desde cero una plataforma SaaS de última milla, incluyendo backend, frontend, infraestructura cloud e integraciones externas.',
              'Entregué un sistema que gestionaba aproximadamente 5.000 envíos diarios, con integraciones con Cainiao y Citibox.',
              'Implementé una arquitectura AWS Serverless, geolocalización con Google Maps y optimización de rutas con Routific; también colaboré en MoxDelivery, una plataforma SaaS de entrega a domicilio.',
            ],
            technologies:
              'Laravel, PHP, TypeScript, Node.js, Vue.js, Nuxt, AWS, Serverless, Redis, DynamoDB, MySQL, GraphQL, Google Maps, Routific, Docker',
          },
          {
            title: 'Hyve Innovation Community',
            subtitle: 'Ingeniero de software full stack',
            period: 'Ene 2017 — Feb 2021',
            bullets: [
              'Diseñé y desarrollé sistemas backend y frontend para productos de distintas industrias y clientes empresariales.',
              'Para Hörmann, construí una plataforma de monitorización en tiempo real para aproximadamente 200 dispositivos distribuidos en cinco almacenes.',
              'Desarrollé otros productos, como Lenogulf, una plataforma de comercio de semillas, e HYVE Crowd, una plataforma de crowdsourcing.',
            ],
            technologies:
              'PHP, Laravel, Node.js, React, Vue.js, Nuxt, Next.js, Express, Symfony, MySQL, MongoDB, Docker, Tailwind CSS',
          },
        ],
      },
      {
        title: 'Proyectos de código abierto',
        kind: 'projects',
        entries: [
          {
            title: 'nuxt-laravelize · vautext-brain · agent-skills',
            body: 'Selección de proyectos de código abierto sobre arquitectura, automatización y flujos de ingeniería asistidos por IA.',
            links: [
              {
                label: 'nuxt-laravelize',
                href: 'https://github.com/luckys/nuxt-laravelize',
              },
              { label: 'vautext-brain', href: 'https://github.com/luckys/vautext-brain' },
              { label: 'agent-skills', href: 'https://github.com/luckys/agent-skills' },
            ],
          },
        ],
      },
      {
        title: 'Enfoque de ingeniería',
        kind: 'approach',
        entries: [
          {
            title: 'Arquitectura pragmática',
            body: 'Aplico Domain-Driven Design y Arquitectura Hexagonal cuando la complejidad del dominio lo justifica; si no, prefiero soluciones sencillas.',
          },
          {
            title: 'Responsabilidad integral',
            body: 'Conecto las decisiones de producto con la arquitectura, la implementación, las pruebas, la entrega y las operaciones en producción.',
          },
          {
            title: 'Seguridad y calidad verificable',
            body: 'Priorizo contratos explícitos, autorización segura ante fallos, entregas reproducibles y pruebas automatizadas de integración y extremo a extremo.',
          },
          {
            title: 'IA como palanca de ingeniería',
            body: 'Uso herramientas de IA para acelerar tareas repetitivas, exploración e integración de producto, manteniendo el criterio de ingeniería en arquitectura, corrección y seguridad.',
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
            title: 'Idiomas',
            body: 'Español (nativo) · Inglés (profesional)',
          },
        ],
      },
    ],
  },
}
