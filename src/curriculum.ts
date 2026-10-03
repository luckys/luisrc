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
    headline: 'Senior Software Engineer / Tech Lead',
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
            body: 'Senior Software Engineer and hands-on Tech Lead with nearly 10 years of full-stack development experience across SaaS, e-commerce and logistics. Specializes in TypeScript, Node.js, NestJS, React, Vue.js, Nuxt and PostgreSQL. Has built products from zero to production and led a 4-person team on an e-commerce platform processing approximately 1,000 orders per day. Experience in legacy code refactoring, platform modernization and Nuxt 2 to Nuxt 3 migration. Owns architecture, automated testing, security, CI/CD and production operations, with practical AI integration experience using OpenAI API, RAG and AI SDK.',
          },
        ],
      },
      {
        title: 'Technical skills',
        kind: 'expertise',
        entries: [
          {
            title: 'Languages',
            body: 'TypeScript, JavaScript, Python (working knowledge), PHP',
          },
          {
            title: 'Backend & APIs',
            body: 'Node.js, NestJS, Express, Laravel, Symfony, REST APIs, GraphQL, third-party integrations, asynchronous processing, background jobs, Redis, BullMQ',
          },
          {
            title: 'Frontend',
            body: 'React (React.js), React Router, Next.js, Vue.js, Nuxt, Vite, Tailwind CSS',
          },
          {
            title: 'AI product engineering',
            body: 'OpenAI API, Amazon Bedrock, Retrieval-Augmented Generation (RAG), AI SDK, Large Language Model (LLM) integration, AI-assisted engineering workflows',
          },
          {
            title: 'Data, architecture & security',
            body: 'PostgreSQL, MySQL, MongoDB, DynamoDB, Redis, Domain-Driven Design (DDD), Hexagonal Architecture, bounded contexts, PostgreSQL Row-Level Security (RLS), fail-closed authorization, concurrency control',
          },
          {
            title: 'Cloud infrastructure & delivery',
            body: 'Amazon Web Services (AWS), AWS Lambda, Amazon SQS, Amazon SES, serverless architecture, Infrastructure as Code (IaC) with Terraform, Docker, Docker Compose, Kubernetes, Linux, Cloudflare, Heroku, Continuous Integration / Continuous Delivery (CI/CD), GitHub Actions, GitLab CI, reproducible deployments, database migrations, production operations',
          },
          {
            title: 'Monitoring & payment integrations',
            body: 'Amazon CloudWatch, application error monitoring with Sentry and GlitchTip; payment gateway integrations with Stripe and Redsys',
          },
          {
            title: 'Automated testing & quality',
            body: 'Test-Driven Development (TDD), Vitest, React Testing Library, Playwright, unit testing, integration testing, HTTP contract testing, end-to-end (E2E) testing, automated quality gates',
          },
          {
            title: 'Refactoring & legacy modernization',
            body: 'Legacy code maintenance, behavior-preserving refactoring, technical debt reduction, incremental modernization, framework migrations, regression testing, maintainability',
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
              'Built integrations with Odoo and DocuSeal, Redsys payment integration, and queue-based background processing with Redis and BullMQ; established reproducible database migrations, Docker/Docker Compose workflows and CI/CD.',
              'Established automated quality gates with TDD, Vitest, React Testing Library, Playwright, PostgreSQL integration tests, HTTP contracts and Zod, and integrated AI capabilities using OpenAI API, RAG and AI SDK.',
              'Used GlitchTip for application error monitoring.',
            ],
            technologies:
              'TypeScript, Node.js, NestJS, React, PostgreSQL, Redis, BullMQ, Docker, Docker Compose, GlitchTip, Redsys, CI/CD, Zod, OpenAI API, RAG, AI SDK',
          },
          {
            title: 'TALKUAL',
            subtitle: 'CTO / Tech Lead',
            period: 'May 2023 — Nov 2025',
            bullets: [
              'Led technology and product engineering for an e-commerce platform processing approximately 1,000 orders per day, managing a 4-person team while remaining hands-on in delivery.',
              'Defined architecture, technology strategy and product priorities with business stakeholders, balancing short-term delivery with long-term platform evolution.',
              'Refactored legacy code in the e-commerce platform to improve maintainability and code quality, addressing technical debt alongside product delivery.',
              'Led the Nuxt 2 to Nuxt 3 migration, improving performance, maintainability and access to the modern Vue/Nuxt ecosystem.',
              'Integrated Odoo to automate accounting and manufacturing workflows tied to the order lifecycle.',
              'Integrated Redsys payments and worked with GitHub Actions and GitLab CI pipelines, using Docker Compose for containerized development workflows.',
            ],
            technologies:
              'TypeScript, Node.js, Vue.js, Nuxt, PostgreSQL, Odoo, Redsys, Heroku, Docker, Docker Compose, GitHub Actions, GitLab CI',
          },
          {
            title: 'Tuklo',
            subtitle: 'Full-Stack Software Engineer / Tech Lead',
            period: 'Mar 2021 — May 2023',
            bullets: [
              'Designed and built a last-mile SaaS platform from the ground up across backend, frontend, cloud infrastructure and external integrations.',
              'Delivered a system handling approximately 5,000 shipments per day, including integrations with Cainiao and Citibox.',
              'Implemented cloud infrastructure using AWS Serverless architecture for the logistics platform, with Redis, DynamoDB and MySQL in the stack; integrated Google Maps geolocation and route optimization with Routific, and contributed to MoxDelivery, a SaaS home-delivery platform.',
              'Worked with Terraform for Infrastructure as Code (IaC), Kubernetes, Docker Compose, and CI/CD pipelines using GitHub Actions and GitLab CI.',
              'Integrated Stripe payments and used Sentry for application error monitoring.',
              'Worked with AWS Lambda for serverless execution, Amazon SQS for message queues, Amazon SES for email delivery, Amazon CloudWatch for monitoring, and Amazon Bedrock.',
            ],
            technologies:
              'Laravel, PHP, TypeScript, Node.js, Vue.js, Nuxt, AWS, Lambda, SQS, SES, CloudWatch, Bedrock, Serverless, Terraform, Kubernetes, Docker, Docker Compose, GitHub Actions, GitLab CI, Sentry, Stripe, Redis, DynamoDB, MySQL, GraphQL, Google Maps, Routific',
          },
          {
            title: 'Hyve Innovation Community',
            subtitle: 'Full-Stack Software Engineer',
            period: 'Jan 2017 — Feb 2021',
            bullets: [
              'Designed and developed backend and frontend systems for products across multiple industries and enterprise clients.',
              'For Hörmann, built a real-time monitoring platform for approximately 200 devices distributed across 5 warehouses.',
              'Delivered additional products including Lenogulf, a seed-trading platform, and HYVE Crowd, a crowdsourcing platform.',
              'Worked with AWS cloud infrastructure and containerized environments using Docker and Docker Compose.',
            ],
            technologies:
              'PHP, Laravel, Node.js, React, Vue.js, Nuxt, Next.js, Express, Symfony, MySQL, MongoDB, AWS, Docker, Docker Compose, Tailwind CSS',
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
              'Building an open-source educational platform that converts technical documentation into practical learning paths and production-like applications.',
              'Own product design and implementation, applying use-case-driven architecture, maintainable code and pragmatic software-engineering practices.',
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
        title: 'Engineering approach',
        kind: 'approach',
        entries: [
          {
            title: 'Pragmatic architecture',
            body: 'Apply Domain-Driven Design and Hexagonal Architecture when domain complexity justifies them; prefer simple designs when it does not.',
          },
          {
            title: 'Safe refactoring & legacy code',
            body: 'Approach existing systems through their business behavior and dependencies. Favor small, behavior-preserving changes supported by regression tests, and incremental modernization over unnecessary rewrites.',
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
    headline: 'Ingeniero de software sénior / Tech Lead',
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
            body: 'Ingeniero de software sénior (Senior Software Engineer) y Tech Lead con casi 10 años de experiencia en desarrollo full stack de productos SaaS, comercio electrónico y logística. Especializado en TypeScript, Node.js, NestJS, React, Vue.js, Nuxt y PostgreSQL. He construido productos desde cero hasta producción y liderado un equipo de cuatro personas en una plataforma con aproximadamente 1.000 pedidos diarios. Experiencia en refactoring de código heredado (legacy code), modernización de plataformas y migración de Nuxt 2 a Nuxt 3. Asumo arquitectura, pruebas automatizadas, seguridad, CI/CD y operaciones en producción, con experiencia práctica en integración de IA mediante OpenAI API, RAG y AI SDK.',
          },
        ],
      },
      {
        title: 'Competencias técnicas',
        kind: 'expertise',
        entries: [
          {
            title: 'Lenguajes',
            body: 'TypeScript, JavaScript, Python (conocimientos prácticos), PHP',
          },
          {
            title: 'Backend y APIs',
            body: 'Node.js, NestJS, Express, Laravel, Symfony, APIs REST, GraphQL, integraciones con terceros, procesamiento asíncrono, tareas en segundo plano, Redis, BullMQ',
          },
          {
            title: 'Frontend',
            body: 'React (React.js), React Router, Next.js, Vue.js, Nuxt, Vite, Tailwind CSS',
          },
          {
            title: 'Ingeniería de producto con IA',
            body: 'OpenAI API, Amazon Bedrock, generación aumentada por recuperación (Retrieval-Augmented Generation, RAG), AI SDK, integración de modelos de lenguaje (LLM), flujos de ingeniería asistidos por IA',
          },
          {
            title: 'Datos, arquitectura y seguridad',
            body: 'PostgreSQL, MySQL, MongoDB, DynamoDB, Redis, Domain-Driven Design (DDD), Arquitectura Hexagonal, contextos delimitados, Row-Level Security (RLS) en PostgreSQL, autorización segura ante fallos, control de concurrencia',
          },
          {
            title: 'Infraestructura cloud y entrega',
            body: 'Amazon Web Services (AWS), AWS Lambda, Amazon SQS, Amazon SES, arquitectura serverless, infraestructura como código (IaC) con Terraform, Docker, Docker Compose, Kubernetes, Linux, Cloudflare, Heroku, integración y entrega continuas (CI/CD), GitHub Actions, GitLab CI, despliegues reproducibles, migraciones de bases de datos, operaciones en producción',
          },
          {
            title: 'Monitorización e integraciones de pagos',
            body: 'Amazon CloudWatch, monitorización de errores de aplicaciones con Sentry y GlitchTip; integración de pasarelas de pago con Stripe y Redsys',
          },
          {
            title: 'Pruebas automatizadas y calidad',
            body: 'Desarrollo guiado por pruebas (TDD), Vitest, React Testing Library, Playwright, pruebas unitarias, pruebas de integración, pruebas de contratos HTTP, pruebas de extremo a extremo (E2E), controles automatizados de calidad',
          },
          {
            title: 'Refactoring y modernización de legacy code',
            body: 'Mantenimiento de código heredado, refactorización sin cambios de comportamiento, reducción de deuda técnica, modernización incremental, migraciones de frameworks, pruebas de regresión, mantenibilidad',
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
              'Desarrollé integraciones con Odoo y DocuSeal, la integración de pagos con Redsys y procesamiento en segundo plano mediante colas con Redis y BullMQ; establecí migraciones reproducibles de bases de datos, flujos con Docker/Docker Compose y CI/CD.',
              'Establecí controles automatizados de calidad con TDD, Vitest, React Testing Library, Playwright, pruebas de integración con PostgreSQL, contratos HTTP y Zod; integré capacidades de IA mediante OpenAI API, RAG y AI SDK.',
              'Utilicé GlitchTip para monitorizar errores de las aplicaciones.',
            ],
            technologies:
              'TypeScript, Node.js, NestJS, React, PostgreSQL, Redis, BullMQ, Docker, Docker Compose, GlitchTip, Redsys, CI/CD, Zod, OpenAI API, RAG, AI SDK',
          },
          {
            title: 'TALKUAL',
            subtitle: 'CTO / Tech Lead',
            period: 'May 2023 — Nov 2025',
            bullets: [
              'Lideré la tecnología y la ingeniería de producto de una plataforma de comercio electrónico que procesaba aproximadamente 1.000 pedidos diarios. Gestioné un equipo de cuatro personas y participé activamente en las entregas.',
              'Definí la arquitectura, la estrategia tecnológica y las prioridades de producto con las partes interesadas del negocio, equilibrando las entregas a corto plazo con la evolución de la plataforma.',
              'Refactoricé código heredado (legacy code) de la plataforma de comercio electrónico para mejorar su mantenibilidad y calidad, abordando la deuda técnica junto con las entregas de producto.',
              'Lideré la migración de Nuxt 2 a Nuxt 3, mejorando el rendimiento y la mantenibilidad, y facilitando la adopción del ecosistema moderno de Vue/Nuxt.',
              'Integré Odoo para automatizar flujos de contabilidad y fabricación vinculados al ciclo de vida de los pedidos.',
              'Integré pagos con Redsys y trabajé con pipelines de GitHub Actions y GitLab CI, usando Docker Compose para flujos de desarrollo con contenedores.',
            ],
            technologies:
              'TypeScript, Node.js, Vue.js, Nuxt, PostgreSQL, Odoo, Redsys, Heroku, Docker, Docker Compose, GitHub Actions, GitLab CI',
          },
          {
            title: 'Tuklo',
            subtitle: 'Ingeniero de software full stack / Tech Lead',
            period: 'Mar 2021 — May 2023',
            bullets: [
              'Diseñé y construí desde cero una plataforma SaaS de última milla, incluyendo backend, frontend, infraestructura cloud e integraciones externas.',
              'Entregué un sistema que gestionaba aproximadamente 5.000 envíos diarios, con integraciones con Cainiao y Citibox.',
              'Implementé infraestructura cloud con arquitectura AWS Serverless para la plataforma logística, con Redis, DynamoDB y MySQL en el stack; integré geolocalización con Google Maps y optimización de rutas con Routific, y colaboré en MoxDelivery, una plataforma SaaS de entrega a domicilio.',
              'Trabajé con Terraform para infraestructura como código (IaC), Kubernetes, Docker Compose y pipelines de CI/CD con GitHub Actions y GitLab CI.',
              'Integré pagos con Stripe y utilicé Sentry para monitorizar errores de las aplicaciones.',
              'Trabajé con AWS Lambda para ejecución serverless, Amazon SQS para colas de mensajes, Amazon SES para envío de correo, Amazon CloudWatch para monitorización y Amazon Bedrock.',
            ],
            technologies:
              'Laravel, PHP, TypeScript, Node.js, Vue.js, Nuxt, AWS, Lambda, SQS, SES, CloudWatch, Bedrock, Serverless, Terraform, Kubernetes, Docker, Docker Compose, GitHub Actions, GitLab CI, Sentry, Stripe, Redis, DynamoDB, MySQL, GraphQL, Google Maps, Routific',
          },
          {
            title: 'Hyve Innovation Community',
            subtitle: 'Ingeniero de software full stack',
            period: 'Ene 2017 — Feb 2021',
            bullets: [
              'Diseñé y desarrollé sistemas backend y frontend para productos de distintas industrias y clientes empresariales.',
              'Para Hörmann, construí una plataforma de monitorización en tiempo real para aproximadamente 200 dispositivos distribuidos en cinco almacenes.',
              'Desarrollé otros productos, como Lenogulf, una plataforma de comercio de semillas, e HYVE Crowd, una plataforma de crowdsourcing.',
              'Trabajé con infraestructura cloud en AWS y entornos con contenedores mediante Docker y Docker Compose.',
            ],
            technologies:
              'PHP, Laravel, Node.js, React, Vue.js, Nuxt, Next.js, Express, Symfony, MySQL, MongoDB, AWS, Docker, Docker Compose, Tailwind CSS',
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
              'Desarrollo una plataforma educativa de código abierto que transforma documentación técnica en itinerarios prácticos de aprendizaje y aplicaciones similares a las de producción.',
              'Lidero el diseño e implementación del producto, aplicando arquitectura orientada a casos de uso, código mantenible y prácticas pragmáticas de ingeniería de software.',
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
        title: 'Enfoque de ingeniería',
        kind: 'approach',
        entries: [
          {
            title: 'Arquitectura pragmática',
            body: 'Aplico Domain-Driven Design y Arquitectura Hexagonal cuando la complejidad del dominio lo justifica; si no, prefiero soluciones sencillas.',
          },
          {
            title: 'Refactoring seguro y código heredado',
            body: 'Abordo los sistemas existentes desde su comportamiento de negocio y sus dependencias. Priorizo cambios pequeños que preserven el comportamiento, respaldados por pruebas de regresión, y la modernización incremental frente a reescrituras innecesarias.',
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
