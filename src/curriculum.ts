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
  phone: string
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
      'Luis Ramírez Calle — Senior Full-Stack Software Engineer and Tech Lead specializing in TypeScript, Node.js, React, PostgreSQL, System Design and AWS.',
    eyebrow: 'PROFESSIONAL PROFILE',
    headline: 'Senior Full-Stack Software Engineer & Tech Lead',
    specialism:
      'TypeScript · Node.js / NestJS · React / Vue.js · PostgreSQL · AWS · System Design',
    location: 'Las Palmas de Gran Canaria, Spain (Remote / WET & CET timezones)',
    phone: '+34 644 758 714',
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
            title: 'Full-stack engineering, system design and technical leadership',
            body: 'Senior Software Engineer and hands-on Tech Lead with nearly 10 years of experience designing and delivering scalable SaaS, e-health, e-commerce, aerospace, and logistics platforms. Specializes in TypeScript, Node.js, NestJS, React, Vue.js, PostgreSQL, and AWS Serverless architectures. Proven track record leading distributed engineering teams (up to 4 engineers), scaling platforms to ~1,000 orders/day and ~5,000 deliveries/day with 99.9% uptime. Expertise spans end-to-end product delivery, Domain-Driven Design (DDD), automated testing (TDD), CI/CD pipelines, legacy modernization, and production Generative AI integrations (OpenAI API, RAG, Python microservices).',
          },
        ],
      },
      {
        title: 'Professional experience',
        kind: 'experience',
        entries: [
          {
            title: 'Chief Technology Officer (CTO) & Lead Software Engineer',
            subtitle: 'Medflow S.L.U. — Oncoviva · Remote',
            period: 'Jan 2026 — Present',
            body: 'E-health platform for oncology care coordination. Co-founded the company alongside the CEO, leading product engineering, technical roadmap, and architectural strategy.',
            bullets: [
              'Architected and delivered Oncoviva from zero to production as the sole engineer, building a modular NestJS/TypeScript backend and React frontend adhering to Domain-Driven Design (DDD) and Hexagonal Architecture.',
              'Engineered high-security authentication and authorization for sensitive e-health clinical records: 2FA, HttpOnly refresh tokens, PostgreSQL Row-Level Security (RLS), multi-tenant ownership isolation, concurrency control, and replay protection compliant with healthcare privacy standards.',
              'Designed resilient asynchronous background workflows using Redis and BullMQ for medical document signing (DocuSeal), ERP synchronization (Odoo), and secure payments (Redsys) with zero transaction loss.',
              'Established end-to-end automated testing pipelines with Vitest, React Testing Library, and Playwright, achieving robust coverage across PostgreSQL integration tests, HTTP contracts, and Zod schemas; managed Docker containerization, CI/CD, and production monitoring with GlitchTip.',
              'Integrated production GenAI capabilities utilizing OpenAI API, Retrieval-Augmented Generation (RAG), and the AI SDK for assisted clinical workflows.',
              'Developed a dedicated Python AI microservice for clinical documentation processing, integrating OCR, PII/PHI pseudonymization, clinical RAG, and structured FHIR output with human-in-the-loop review.',
            ],
            technologies:
              'TypeScript, Python, Node.js, NestJS, React, PostgreSQL, Drizzle ORM, Redis, BullMQ, Docker, Docker Compose, GlitchTip, Redsys, CI/CD, Zod, OpenAI API, RAG, AI SDK, OCR, FHIR, pnpm',
          },
          {
            title: 'Chief Technology Officer (CTO) & Tech Lead',
            subtitle: 'TALKUAL · Remote',
            period: 'May 2023 — Nov 2025',
            bullets: [
              'Led a 4-person engineering team for an e-commerce platform processing ~1,000 orders per day, managing agile sprints, code reviews, technical roadmaps, and hands-on full-stack feature delivery.',
              'Defined technology strategy and cloud infrastructure alongside business stakeholders, translating product and operational requirements into scalable architectural priorities.',
              'Spearheaded the frontend migration from Nuxt 2 to Nuxt 3 (Vue.js), enhancing web performance, Core Web Vitals, and developer ergonomics while reducing frontend bundle sizes.',
              'Refactored critical legacy services and database queries in PostgreSQL, eliminating technical debt, reducing production defect rates, and improving system maintainability.',
              'Automated enterprise accounting and manufacturing pipelines with Odoo ERP, integrated Redsys checkout flows, and streamlined containerized CI/CD using Docker, GitHub Actions, and GitLab CI.',
            ],
            technologies:
              'TypeScript, Node.js, Vue.js, Nuxt, PostgreSQL, Odoo, Redsys, Heroku, Docker, Docker Compose, GitHub Actions, GitLab CI, Agile/Scrum',
          },
          {
            title: 'Full-Stack Software Engineer & Tech Lead',
            subtitle: 'Tuklo · Remote',
            period: 'Mar 2021 — May 2023',
            bullets: [
              'Co-built from scratch a last-mile logistics SaaS platform, delivering backend services, web applications, and AWS cloud infrastructure supporting ~5,000 deliveries per day.',
              'Architected a high-throughput, event-driven serverless system on AWS using Node.js and TypeScript, orchestrating Lambda, SQS queues, SES, DynamoDB, Redis caching, and MySQL with 99.9% availability.',
              'Integrated parcel carrier and smart-locker APIs (Cainiao, Citibox), Google Maps, Routific automated route optimization algorithms, and Stripe payments; contributed to MoxDelivery home-delivery SaaS.',
              'Automated cloud provisioning via Terraform (Infrastructure as Code / IaC), managed container workloads with Kubernetes and Docker Compose, and maintained automated CI/CD pipelines via GitHub Actions and GitLab CI.',
            ],
            technologies:
              'Laravel, PHP, TypeScript, Node.js, Vue.js, Nuxt, AWS (Lambda, SQS, SES, CloudWatch, Bedrock), Serverless, Terraform, Kubernetes, Docker, Docker Compose, GitHub Actions, GitLab CI, Sentry, Stripe, Redis, DynamoDB, MySQL, GraphQL, Google Maps, Routific',
          },
          {
            title: 'Full-Stack Software Engineer (External Consultant)',
            subtitle: 'edata consulting (Client: Lufthansa) · Remote',
            period: 'May 2020 — Nov 2020',
            body: 'Aircraft maintenance management software for Lufthansa. Seconded from HYVE Innovate Digital S.L. to collaborate with edata consulting in delivering high-reliability enterprise full-stack solutions.',
            bullets: [
              'Developed mission-critical backend services in Java and Spring Boot for aircraft maintenance planning and fleet operations, implementing clean domain models and RESTful APIs.',
              'Modeled and optimized persistence layers utilizing Oracle Database for ACID-compliant transactional records and CouchDB for decentralized document synchronization and technical logs.',
              'Built responsive enterprise web interfaces using Angular and TypeScript, enabling ground engineers and maintenance technicians to schedule inspections, log work orders, and track compliance.',
            ],
            technologies:
              'Java, Spring Boot, Angular, TypeScript, Oracle Database, CouchDB, RESTful APIs, Git',
          },
          {
            title: 'Full-Stack Software Engineer',
            subtitle: 'HYVE Innovate Digital S.L. · On-site / Hybrid',
            period: 'Jan 2017 — Mar 2021',
            bullets: [
              "Designed and developed full-stack IoT telemetry collection interfaces and dashboards for Hörmann's real-time logistics monitoring platform, processing live telemetry from ~200 devices across 5 warehouse facilities.",
              'Built custom full-stack enterprise web applications for international clients (including Lenogulf commodity trading and HYVE Crowd crowdsourcing) using PHP, Laravel, Symfony, and modern JavaScript frameworks (React, Vue.js, Node.js).',
              'Refactored and maintained complex monolithic codebases, improving code modularity, test coverage, and maintainability.',
              'Configured and maintained containerized development environments and AWS deployments using Docker, Docker Compose, and GitLab CI.',
            ],
            technologies:
              'PHP, Laravel, Node.js, React, Vue.js, Nuxt, Next.js, Express, Symfony, MySQL, MongoDB, Mongoose, AWS, Docker, Docker Compose, GitLab, Tailwind CSS',
          },
        ],
      },
      {
        title: 'Technical skills',
        kind: 'expertise',
        entries: [
          {
            title: 'Languages',
            body: 'TypeScript, JavaScript (ES6+), Python, Java, PHP, SQL, HTML5, CSS3',
          },
          {
            title: 'Backend & APIs',
            body: 'Node.js, NestJS, Express, Spring Boot, RESTful APIs, GraphQL, Laravel, Symfony, Asynchronous Processing, Background Jobs (Redis, BullMQ), Microservices, Clean Architecture',
          },
          {
            title: 'Frontend & UI',
            body: 'React (React.js), Next.js, React Router, Vue.js, Nuxt, Angular, TypeScript, Vite, Tailwind CSS, Responsive Design, State Management, Web Performance, Core Web Vitals',
          },
          {
            title: 'AI Product Engineering & LLMs',
            body: 'AI Agents, Model Context Protocol (MCP), OpenAI API, Claude API (Anthropic), Retrieval-Augmented Generation (RAG) with Python, AI SDK, Large Language Models (LLM), Amazon Bedrock, Vector Search',
          },
          {
            title: 'Data, Architecture & Security',
            body: 'System Design, Domain-Driven Design (DDD), Hexagonal Architecture, PostgreSQL, Drizzle ORM, MySQL, Oracle Database, CouchDB, MongoDB, DynamoDB, Redis, Row-Level Security (RLS), 2FA, OAuth, Data Modeling, Query Optimization',
          },
          {
            title: 'Cloud Infrastructure & DevOps',
            body: 'Amazon Web Services (AWS: Lambda, SQS, SES, CloudWatch, S3, IAM), Serverless, Terraform (Infrastructure as Code / IaC), Docker, Docker Compose, Kubernetes, CI/CD Pipelines, GitHub Actions, GitLab CI, Cloudflare, Sentry, GlitchTip',
          },
          {
            title: 'Automated Testing & Methodologies',
            body: 'Test-Driven Development (TDD), Vitest, React Testing Library, Playwright, Jest, Unit & Integration Testing, End-to-End (E2E), HTTP Contract Testing, Agile / Scrum, Code Review, CI/CD Automation',
          },
          {
            title: 'Technical Leadership',
            body: 'Hands-on Team Leadership, Tech Strategy, Product Roadmapping, Technical Debt Management, System Modernization, Cross-Functional Team Collaboration',
          },
        ],
      },
      {
        title: 'Personal & open-source projects',
        kind: 'projects',
        entries: [
          {
            title: 'LearningHard',
            subtitle:
              'Founder / Open Source Maintainer / Senior Software Engineer (Personal Project)',
            period: 'Nov 2025 — Present',
            bullets: [
              'Building an open-source education platform that turns technical documentation into practical projects with production-like constraints; own product design, architecture and implementation.',
              'Create use-case-driven projects with maintainable architecture and testing, and technical content explaining when to use a technology, why and its trade-offs.',
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
            title: 'Vautext Brain',
            body: 'Self-hosted personal knowledge management application (second brain) for creating, searching, tagging and linking Markdown notes. Includes a knowledge graph, attachments, local folder synchronization, GitHub OAuth authentication and optimistic concurrency control with ETags.',
            technologies: 'Nuxt 4, Nuxt UI, Cloudflare Workers, R2, Turso, Markdown',
            links: [
              { label: 'vautext-brain', href: 'https://github.com/luckys/vautext-brain' },
            ],
          },
          {
            title: 'Agent Skills',
            body: 'Reusable skills for AI coding agents, including Claude Code, Codex and Cursor. Provides practical guidance on Domain-Driven Design (DDD), hexagonal architecture, Test-Driven Development (TDD), refactoring and code review, with selective installation and workflows for configuring agents to a project’s stack and architecture.',
            links: [
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
            title: 'Bachelor of Science (B.S.) in Computer Engineering',
            subtitle:
              'University of Las Palmas de Gran Canaria — Information Technology specialization',
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
      'Luis Ramírez Calle — Ingeniero de software full stack sénior y Tech Lead especializado en TypeScript, Node.js, React, PostgreSQL, Diseño de Sistemas y AWS.',
    eyebrow: 'PERFIL PROFESIONAL',
    headline: 'Ingeniero de software full stack sénior y Tech Lead',
    specialism:
      'TypeScript · Node.js / NestJS · React / Vue.js · PostgreSQL · AWS · Diseño de sistemas',
    location:
      'Las Palmas de Gran Canaria, España (Remoto / Horarios WET y CET)',
    phone: '+34 644 758 714',
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
            title: 'Desarrollo full stack, diseño de sistemas y liderazgo técnico',
            body: 'Ingeniero de software sénior (Senior Software Engineer) y Tech Lead con casi 10 años de experiencia diseñando y entregando plataformas escalables SaaS, salud digital, comercio electrónico, sector aeroespacial y logística. Especializado en TypeScript, Node.js, NestJS, React, Vue.js, PostgreSQL y arquitecturas serverless en AWS. Trayectoria demostrada liderando equipos de ingeniería distribuidos (hasta 4 ingenieros), escalando plataformas a ~1.000 pedidos/día y ~5.000 entregas/día con un 99,9% de disponibilidad. Dominio del ciclo completo de entrega, Domain-Driven Design (DDD), pruebas automatizadas (TDD), CI/CD, modernización de sistemas legacy e integración de IA generativa en producción (OpenAI API, RAG, microservicios en Python).',
          },
        ],
      },
      {
        title: 'Experiencia profesional',
        kind: 'experience',
        entries: [
          {
            title: 'Director de tecnología (CTO) e Ingeniero de software líder',
            subtitle: 'Medflow S.L.U. — Oncoviva · Remoto',
            period: 'Ene 2026 — Actualidad',
            body: 'Plataforma de salud digital para la coordinación de la atención oncológica. Cofundador junto al CEO, liderando la ingeniería de producto, el roadmap técnico y la estrategia arquitectónica.',
            bullets: [
              'Diseñé y construí Oncoviva desde cero hasta producción como único ingeniero, implementando un backend modular en NestJS/TypeScript y frontend en React con Domain-Driven Design (DDD) y Arquitectura Hexagonal.',
              'Implementé autenticación y autorización de alta seguridad para datos clínicos sensibles: 2FA, tokens de refresco HttpOnly, Row-Level Security (RLS) en PostgreSQL, aislamiento por titularidad, control de concurrencia y protección contra repetición conforme a estándares de privacidad sanitaria.',
              'Desarrollé flujos de trabajo asíncronos en segundo plano con Redis y BullMQ para la firma de documentos médicos (DocuSeal), sincronización con ERP (Odoo) y procesamiento de pagos con Redsys con cero pérdida de transacciones.',
              'Establecí una suite completa de pruebas automatizadas con Vitest, React Testing Library y Playwright, cubriendo integración en PostgreSQL, contratos HTTP y validación con Zod; asumí contenedorización con Docker, pipelines de CI/CD y monitorización en producción con GlitchTip.',
              'Integré capacidades de IA generativa en producción mediante OpenAI API, generación aumentada por recuperación (RAG) y AI SDK para asistencia clínica.',
              'Diseñé e implementé un microservicio de IA en Python para el procesamiento de documentación clínica, incluyendo OCR, seudonimización de PII/PHI, RAG clínico y salida estructurada en formato FHIR con revisión humana.',
            ],
            technologies:
              'TypeScript, Python, Node.js, NestJS, React, PostgreSQL, Drizzle ORM, Redis, BullMQ, Docker, Docker Compose, GlitchTip, Redsys, CI/CD, Zod, OpenAI API, RAG, AI SDK, OCR, FHIR, pnpm',
          },
          {
            title: 'Director de tecnología (CTO) y Tech Lead',
            subtitle: 'TALKUAL · Remoto',
            period: 'May 2023 — Nov 2025',
            bullets: [
              'Lideré un equipo de cuatro ingenieros en una plataforma de comercio electrónico con ~1.000 pedidos diarios, gestionando sprints ágiles, revisiones de código, roadmap técnico y entrega activa de software full stack.',
              'Definí la estrategia tecnológica y la arquitectura cloud junto a negocio, traduciendo necesidades operativas y de producto en prioridades de ingeniería escalables.',
              'Lideré la migración del frontend de Nuxt 2 a Nuxt 3 (Vue.js), mejorando el rendimiento web, los Core Web Vitals y la experiencia de desarrollo, reduciendo el tamaño del bundle.',
              'Refactoricé servicios legacy críticos y optimicé consultas en PostgreSQL, eliminando deuda técnica acumulada, reduciendo la tasa de incidencias en producción y aumentando la mantenibilidad.',
              'Automaticé procesos de contabilidad y fabricación con Odoo ERP, integré pasarela de pagos Redsys y estandaricé pipelines de CI/CD con Docker, GitHub Actions y GitLab CI.',
            ],
            technologies:
              'TypeScript, Node.js, Vue.js, Nuxt, PostgreSQL, Odoo, Redsys, Heroku, Docker, Docker Compose, GitHub Actions, GitLab CI, Agile/Scrum',
          },
          {
            title: 'Ingeniero de software full stack y Tech Lead',
            subtitle: 'Tuklo · Remoto',
            period: 'Mar 2021 — May 2023',
            bullets: [
              'Construí desde cero una plataforma SaaS de logística de última milla, entregando servicios backend, frontend e infraestructura cloud en AWS para unas 5.000 entregas diarias.',
              'Diseñé una arquitectura serverless orientada a eventos en AWS con Node.js y TypeScript, integrando Lambda, colas SQS, SES, DynamoDB, caché en Redis y MySQL con una disponibilidad del 99,9%.',
              'Integré APIs de paquetería y taquillas inteligentes (Cainiao, Citibox), Google Maps, optimización automática de rutas con Routific y pagos con Stripe; colaboré en el desarrollo de la plataforma SaaS MoxDelivery.',
              'Gestioné aprovisionamiento en la nube con Terraform (Infrastructure as Code / IaC), orquestación de contenedores con Kubernetes y Docker Compose, y pipelines de CI/CD con GitHub Actions y GitLab CI.',
            ],
            technologies:
              'Laravel, PHP, TypeScript, Node.js, Vue.js, Nuxt, AWS (Lambda, SQS, SES, CloudWatch, Bedrock), Serverless, Terraform, Kubernetes, Docker, Docker Compose, GitHub Actions, GitLab CI, Sentry, Stripe, Redis, DynamoDB, MySQL, GraphQL, Google Maps, Routific',
          },
          {
            title: 'Ingeniero de software full stack (Consultor externo)',
            subtitle: 'edata consulting (Cliente: Lufthansa) · Remoto',
            period: 'May 2020 — Nov 2020',
            body: 'Software de gestión y mantenimiento de aeronaves para Lufthansa. Colaboración externa mediante cesión de servicios desde HYVE Innovate Digital S.L. junto al equipo de edata consulting para desarrollar soluciones empresariales de alta disponibilidad.',
            bullets: [
              'Desarrollé servicios backend críticos con Java y Spring Boot para la planificación y operativa del mantenimiento de flotas de aeronaves, implementando modelos de dominio limpios y APIs RESTful.',
              'Diseñé y optimicé capas de persistencia combinando Oracle Database para transacciones críticas y CouchDB para la sincronización documental distribuida de registros técnicos.',
              'Construí interfaces web empresariales con Angular y TypeScript, facilitando a los equipos técnicos la asignación de órdenes de trabajo, seguimiento de revisiones y trazabilidad normativa.',
            ],
            technologies:
              'Java, Spring Boot, Angular, TypeScript, Oracle Database, CouchDB, APIs RESTful, Git',
          },
          {
            title: 'Ingeniero de software full stack',
            subtitle: 'HYVE Innovate Digital S.L. · Presencial / Híbrido',
            period: 'Ene 2017 — Mar 2021',
            bullets: [
              'Diseñé y desarrollé la plataforma web e interfaces de ingesta de telemetría IoT en tiempo real para Hörmann, monitorizando ~200 dispositivos en cinco centros logísticos.',
              'Desarrollé aplicaciones web empresariales a medida para clientes internacionales (como la plataforma de comercio Lenogulf y crowdsourcing HYVE Crowd) con PHP, Laravel, Symfony y frameworks JavaScript (React, Vue.js, Node.js).',
              'Refactoricé y mantuve bases de código monolíticas complejas, incrementando la modularidad, cobertura de pruebas y legibilidad del código.',
              'Configuré entornos de desarrollo y despliegues cloud en AWS mediante contenedores con Docker, Docker Compose y GitLab CI.',
            ],
            technologies:
              'PHP, Laravel, Node.js, React, Vue.js, Nuxt, Next.js, Express, Symfony, MySQL, MongoDB, Mongoose, AWS, Docker, Docker Compose, GitLab, Tailwind CSS',
          },
        ],
      },
      {
        title: 'Competencias técnicas',
        kind: 'expertise',
        entries: [
          {
            title: 'Lenguajes',
            body: 'TypeScript, JavaScript (ES6+), Python, Java, PHP, SQL, HTML5, CSS3',
          },
          {
            title: 'Backend y APIs',
            body: 'Node.js, NestJS, Express, Spring Boot, APIs RESTful, GraphQL, Laravel, Symfony, procesamiento asíncrono, colas y background jobs (Redis, BullMQ), microservicios, arquitectura limpia (Clean Architecture)',
          },
          {
            title: 'Frontend y UI',
            body: 'React (React.js), Next.js, React Router, Vue.js, Nuxt, Angular, TypeScript, Vite, Tailwind CSS, diseño responsivo, gestión de estado, rendimiento web, Core Web Vitals',
          },
          {
            title: 'Ingeniería de producto con IA y LLMs',
            body: 'Desarrollo de agentes de IA, Model Context Protocol (MCP), OpenAI API, Claude API (Anthropic), generación aumentada por recuperación (RAG) con Python, AI SDK, modelos de lenguaje (LLM), Amazon Bedrock, búsqueda vectorial',
          },
          {
            title: 'Datos, arquitectura y seguridad',
            body: 'Diseño de sistemas (System Design), Domain-Driven Design (DDD), Arquitectura Hexagonal, PostgreSQL, Drizzle ORM, MySQL, Oracle Database, CouchDB, MongoDB, DynamoDB, Redis, Row-Level Security (RLS), 2FA, OAuth, modelado de datos, optimización de consultas SQL',
          },
          {
            title: 'Infraestructura cloud y DevOps',
            body: 'Amazon Web Services (AWS: Lambda, SQS, SES, CloudWatch, S3, IAM), Serverless, Terraform (Infrastructure as Code / IaC), Docker, Docker Compose, Kubernetes, Linux, Cloudflare, pipelines de CI/CD, GitHub Actions, GitLab CI, monitorización con Sentry y GlitchTip',
          },
          {
            title: 'Pruebas automatizadas y metodologías',
            body: 'Desarrollo guiado por pruebas (TDD), Vitest, React Testing Library, Playwright, Jest, pruebas unitarias y de integración, pruebas de extremo a extremo (E2E), contratos HTTP, metodologías ágiles (Agile / Scrum), revisión de código (Code Review)',
          },
          {
            title: 'Liderazgo técnico',
            body: 'Liderazgo técnico de equipos, estrategia tecnológica, roadmap de producto, gestión de deuda técnica, modernización de sistemas, colaboración interdisciplinar con negocio y producto',
          },
        ],
      },
      {
        title: 'Proyectos personales y de código abierto',
        kind: 'projects',
        entries: [
          {
            title: 'LearningHard',
            subtitle:
              'Fundador / Mantenedor de código abierto / Ingeniero de software sénior (proyecto personal)',
            period: 'Nov 2025 — Actualidad',
            bullets: [
              'Desarrollo una plataforma educativa de código abierto que convierte documentación técnica en proyectos prácticos con restricciones de producción; asumo diseño de producto, arquitectura e implementación.',
              'Creo proyectos orientados a casos de uso con arquitectura mantenible y pruebas, y contenido técnico sobre cuándo utilizar una tecnología, por qué y qué compromisos implica.',
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
            title: 'Vautext Brain',
            body: 'Aplicación autoalojada de gestión de conocimiento personal (segundo cerebro) para crear, buscar, etiquetar y enlazar notas Markdown. Incluye grafo de conocimiento, archivos adjuntos, sincronización con carpetas locales, autenticación con GitHub OAuth y control de concurrencia optimista mediante ETags.',
            technologies: 'Nuxt 4, Nuxt UI, Cloudflare Workers, R2, Turso, Markdown',
            links: [
              { label: 'vautext-brain', href: 'https://github.com/luckys/vautext-brain' },
            ],
          },
          {
            title: 'Agent Skills',
            body: 'Colección de skills reutilizables para agentes de programación con IA como Claude Code, Codex y Cursor. Ofrece guías prácticas de Domain-Driven Design (DDD), arquitectura hexagonal, Test-Driven Development (TDD), refactorización y revisión de código, con instalación selectiva y flujos para configurar los agentes según el stack y la arquitectura del proyecto.',
            links: [
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
            title: 'Grado en Ingeniería Informática (B.S.)',
            subtitle:
              'Universidad de Las Palmas de Gran Canaria — Especialidad en Tecnologías de la Información',
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
