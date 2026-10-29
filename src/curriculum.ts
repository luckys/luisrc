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
  kind:
    | 'summary'
    | 'expertise'
    | 'experience'
    | 'projects'
    | 'education'
    | 'languages'
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
      'Luis Ramírez Calle — Senior Full-Stack Software Engineer and Tech Lead specializing in TypeScript, Node.js, React, PostgreSQL (Postgres), System Design, Microservices and AWS.',
    eyebrow: 'PROFESSIONAL PROFILE',
    headline: 'Senior Full-Stack Software Engineer & Tech Lead',
    specialism:
      'TypeScript · Node.js · Python · PHP · React / Vue.js · PostgreSQL (Postgres) · AWS · System Design · DDD',
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
            body: 'Senior Software Engineer and hands-on Tech Lead with nearly 10 years of experience designing and delivering scalable SaaS, e-health, e-commerce, aerospace, and logistics platforms. Specializes in TypeScript, Node.js, NestJS, React, Vue.js, PostgreSQL (Postgres), and AWS Serverless & Microservices architectures. Proven track record leading distributed engineering teams (up to 4 engineers), scaling platforms to ~1,000 orders/day and ~5,000 deliveries/day with 99.9% uptime. Expertise spans end-to-end product delivery, Domain-Driven Design (DDD), automated testing (TDD), CI/CD pipelines, legacy modernization, and production Generative AI integrations (OpenAI API, RAG, Python microservices).',
          },
        ],
      },
      {
        title: 'Professional experience',
        kind: 'experience',
        entries: [
          {
            title: 'Chief Technology Officer (CTO) & Senior Software Engineer',
            subtitle: 'Medflow S.L.U. Oncoviva · Remote',
            period: 'Jan 2026 — Present',
            body: 'E-health platform for oncology care coordination. Co-founded the company alongside the CEO, leading product engineering, technical roadmap, and architectural strategy.',
            bullets: [
              'Architected and delivered Oncoviva from zero to production as the sole engineer, building a modular NestJS/TypeScript backend and React frontend adhering to Domain-Driven Design (DDD) and Hexagonal Architecture.',
              'Engineered high-security authentication and authorization for sensitive e-health clinical records: OAuth 2.0, JWT, 2FA, HttpOnly refresh tokens, PostgreSQL Row-Level Security (RLS), multi-tenant data isolation, concurrency control, and OWASP compliance.',
              'Designed resilient asynchronous background workflows using Redis and BullMQ for medical document signing (DocuSeal), ERP synchronization (Odoo), and secure payments (Redsys), cutting clinical processing turnaround by 60% with zero transaction loss.',
              'Established end-to-end automated testing pipelines with Vitest, React Testing Library, and Playwright, achieving >85% test coverage across unit, integration (PostgreSQL), and HTTP contracts; automated CI/CD and production monitoring with GlitchTip.',
              'Integrated production GenAI capabilities utilizing OpenAI API, Retrieval-Augmented Generation (RAG), and the AI SDK for assisted clinical workflows.',
              'Developed a dedicated Python AI microservice for clinical documentation processing, integrating OCR, PII/PHI pseudonymization, clinical RAG, and structured FHIR output with human-in-the-loop review.',
            ],
            technologies:
              'TypeScript, Python, Node.js, NestJS, React, PostgreSQL (Postgres), Drizzle ORM, Redis, BullMQ, Docker, Docker Compose, OAuth 2.0, JWT, Redsys, CI/CD, Vitest, Playwright, Zod, OpenAI API, RAG, AI SDK, OCR, FHIR',
          },
          {
            title: 'Chief Technology Officer (CTO) & Tech Lead',
            subtitle: 'TALKUAL · Remote',
            period: 'May 2023 — Nov 2025',
            bullets: [
              'Led engineering executing CTO duties for an e-commerce platform (~1,000 orders/day), defining quarterly product/tech roadmaps, system architecture, and technical hiring processes.',
              'Streamlined checkout from 8 to 4 steps cutting drop-off by 40%, and increased AOV/LTV by designing subscription upselling flows (recurring box add-ons) and flexible order management.',
              'Engineered the platform Design System and migrated storefront and backoffice from Nuxt 2 to Nuxt 3 (Vue.js/TypeScript), adding dynamic box customization and food exclusion preferences.',
              'Refactored the Strapi backend (Node.js/PostgreSQL) applying DDD, bounded contexts, and the Money pattern; optimized SQL queries for Metabase analytics and established unit, integration, and E2E test suites.',
              'Built full Odoo ERP integration (accounting and manufacturing), optimized HubSpot CRM sync for speed and reliability, integrated Redsys checkout, and automated containerized Heroku CI/CD.',
            ],
            technologies:
              'TypeScript, Node.js, Vue.js, Nuxt, Strapi, PostgreSQL (Postgres), MongoDB, Odoo, HubSpot, Metabase, Redsys, Heroku, Docker, GitHub Actions, GitLab CI, DDD, Design Systems, Vitest, CI/CD',
          },
          {
            title: 'Senior Product Engineer & Tech Lead',
            subtitle: 'Tuklo (Grupo Mox) · Remote',
            period: 'Mar 2021 — May 2023',
            bullets: [
              'Co-built from scratch the 360° SaaS logistics platform (SPOC) with a Laravel (PHP) GraphQL backend and Nuxt 2 (Vue.js/TypeScript) frontend, translating complex logistics operations into intuitive workflows.',
              'Engineered high-volume data ingestion pipelines connecting heterogeneous shipping manifests via REST/GraphQL APIs (Cainiao, YunExpress, CACESA air-cargo/customs) and batch CSV processors under a unified domain model.',
              'Integrated smart-locker networks (Citibox residential lockers and Cainiao public lockers) to maximize first-attempt delivery rates, alongside automated route optimization (Routific, Google Maps) reducing cost per stop.',
              'Architected an event-driven serverless system on AWS (Node.js/TS, Lambda, SQS, DynamoDB, Redis, Stripe) with 99.9% uptime, automated via Terraform (IaC), Docker, Kubernetes, and CI/CD pipelines.',
            ],
            technologies:
              'Laravel, PHP, GraphQL, TypeScript, Node.js, Vue.js, Nuxt, AWS (Lambda, SQS, SES, DynamoDB), Serverless, Event-Driven Architecture (EDA), Terraform, Kubernetes, Docker, Docker Compose, GitHub Actions, GitLab CI, Redis, MySQL, Citibox, Cainiao, YunExpress, CACESA, Routific, Google Maps Platform, Stripe',
          },
          {
            title: 'Full-Stack Software Engineer (External Consultant)',
            subtitle:
              'edata consulting (Lufthansa project — Secondment from HYVE) · Remote',
            period: 'May 2020 — Nov 2020',
            body: 'Aircraft maintenance management software for Lufthansa. Seconded from HYVE Innovate Digital S.L. to collaborate with edata consulting in delivering high-reliability enterprise full-stack solutions.',
            bullets: [
              'Developed mission-critical backend services in Java and Spring Boot for aircraft maintenance planning and fleet operations, implementing clean domain models and RESTful APIs with 100% regulatory audit compliance.',
              'Modeled and optimized persistence layers utilizing Oracle Database for ACID-compliant transactional records and CouchDB for decentralized document synchronization and technical logs.',
              'Built responsive enterprise web interfaces using Angular and TypeScript, enabling ground engineers and maintenance technicians to schedule inspections, log work orders, and track aircraft safety protocols.',
            ],
            technologies:
              'Java, Spring Boot, Angular, TypeScript, Oracle Database, CouchDB, RESTful APIs, Microservices, Git',
          },
          {
            title: 'Full-Stack Software Engineer',
            subtitle: 'HYVE Innovate Digital S.L. · On-site / Hybrid',
            period: 'Jan 2017 — Mar 2021',
            bullets: [
              "Designed and developed full-stack IoT telemetry collection interfaces, WebSockets, and real-time dashboards for Hörmann's logistics monitoring platform, processing live telemetry from ~200 devices across 5 warehouse facilities.",
              'Built custom full-stack enterprise web applications for international clients (including Lenogulf commodity trading and HYVE Crowd crowdsourcing) using PHP, Laravel, Symfony, and modern JavaScript frameworks (React, Vue.js, Node.js).',
              'Refactored and maintained complex monolithic codebases, improving code modularity, test coverage, and maintainability.',
              'Provisioned and automated containerized environments and AWS cloud deployments with Docker, Docker Compose, and GitLab CI, reducing deployment cycles by 40%.',
            ],
            technologies:
              'PHP, Laravel, Node.js, React, Vue.js, Nuxt, Next.js, Express, Symfony, MySQL, MongoDB, Mongoose, AWS, Docker, Docker Compose, GitLab CI, CI/CD, WebSockets, RESTful APIs, Tailwind CSS',
          },
        ],
      },
      {
        title: 'Technical skills',
        kind: 'expertise',
        entries: [
          {
            title: 'Languages',
            body: 'TypeScript, JavaScript (ES6+), Python, Java, PHP, SQL, HTML5, CSS3, Bash / Shell',
          },
          {
            title: 'Backend & APIs',
            body: 'Node.js, NestJS, Express, Spring Boot, RESTful APIs, GraphQL, WebSockets, Laravel, Symfony, Asynchronous Processing, Background Jobs & Queues (Redis, BullMQ), Microservices Architecture, Clean Architecture',
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
            body: 'System Design, Domain-Driven Design (DDD), Hexagonal Architecture, Event-Driven Architecture (EDA), PostgreSQL (Postgres), Drizzle ORM, MySQL, Oracle Database, CouchDB, MongoDB, DynamoDB, Redis, Row-Level Security (RLS), OAuth 2.0, JWT, 2FA, OWASP, Data Modeling, SQL Query Optimization',
          },
          {
            title: 'Cloud Infrastructure & DevOps',
            body: 'Amazon Web Services (AWS: Lambda, SQS, SES, CloudWatch, S3, IAM, Bedrock), Serverless, Terraform (Infrastructure as Code / IaC), Docker, Docker Compose, Kubernetes, CI/CD Pipelines, GitHub Actions, GitLab CI, Cloudflare, Sentry, GlitchTip',
          },
          {
            title: 'Automated Testing & Methodologies',
            body: 'Test-Driven Development (TDD), Vitest, React Testing Library, Playwright, Jest, Unit & Integration Testing, End-to-End (E2E), HTTP Contract Testing, Agile / Scrum, Code Reviews, Trunk-Based Development',
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
            links: [
              { label: 'LearningHard', href: 'https://learninghard.dev/' },
            ],
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
        title: 'Education',
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
        ],
      },
      {
        title: 'Languages',
        kind: 'languages',
        entries: [
          {
            title: 'Spanish (Native) · English (Full professional proficiency / C1)',
            body: 'Fluent in technical communication, team leadership, cross-border collaboration, and technical documentation.',
          },
        ],
      },
    ],
  },
  es: {
    pageTitle: 'Currículum vitae',
    pageDescription:
      'Luis Ramírez Calle — Ingeniero de software full stack sénior y Tech Lead especializado en TypeScript, Node.js, React, PostgreSQL (Postgres), Diseño de Sistemas, Microservicios y AWS.',
    eyebrow: 'PERFIL PROFESIONAL',
    headline: 'Ingeniero de software full stack sénior y Tech Lead',
    specialism:
      'TypeScript · Node.js · Python · PHP · React / Vue.js · PostgreSQL (Postgres) · AWS · Diseño de sistemas · DDD',
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
            body: 'Ingeniero de software sénior (Senior Software Engineer) y Tech Lead con casi 10 años de experiencia diseñando y entregando plataformas escalables SaaS, salud digital, comercio electrónico, sector aeroespacial y logística. Especializado en TypeScript, Node.js, NestJS, React, Vue.js, PostgreSQL (Postgres) y arquitecturas serverless y de microservicios en AWS. Trayectoria demostrada liderando equipos de ingeniería distribuidos (hasta 4 ingenieros), escalando plataformas a ~1.000 pedidos/día y ~5.000 entregas/día con un 99,9% de disponibilidad. Dominio del ciclo completo de entrega, Domain-Driven Design (DDD), pruebas automatizadas (TDD), CI/CD, modernización de sistemas legacy e integración de IA generativa en producción (OpenAI API, RAG, microservicios en Python).',
          },
        ],
      },
      {
        title: 'Experiencia profesional',
        kind: 'experience',
        entries: [
          {
            title: 'Director de tecnología (CTO) e Ingeniero de software sénior',
            subtitle: 'Medflow S.L.U. Oncoviva · Remoto',
            period: 'Ene 2026 — Actualidad',
            body: 'Plataforma de salud digital para la coordinación de la atención oncológica. Cofundador junto al CEO, liderando la ingeniería de producto, el roadmap técnico y la estrategia arquitectónica.',
            bullets: [
              'Diseñé y construí Oncoviva desde cero hasta producción como único ingeniero, implementando un backend modular en NestJS/TypeScript y frontend en React con Domain-Driven Design (DDD) y Arquitectura Hexagonal.',
              'Implementé autenticación y autorización de alta seguridad para datos clínicos sensibles: OAuth 2.0, JWT, 2FA, tokens de refresco HttpOnly, Row-Level Security (RLS) en PostgreSQL, aislamiento multi-inquilino, control de concurrencia y cumplimiento de estándares OWASP y privacidad sanitaria.',
              'Desarrollé flujos de trabajo asíncronos en segundo plano con Redis y BullMQ para la firma de documentos médicos (DocuSeal), sincronización con ERP (Odoo) y procesamiento de pagos con Redsys, reduciendo los tiempos de tramitación clínica en un 60% con cero pérdida de transacciones.',
              'Establecí una suite completa de pruebas automatizadas con Vitest, React Testing Library y Playwright, superando el 85% de cobertura en pruebas unitarias, de integración (PostgreSQL) y contratos HTTP; automaticé pipelines de CI/CD y monitorización en producción con GlitchTip.',
              'Integré capacidades de IA generativa en producción mediante OpenAI API, generación aumentada por recuperación (RAG) y AI SDK para asistencia clínica.',
              'Diseñé e implementé un microservicio de IA en Python para el procesamiento de documentación clínica, incluyendo OCR, seudonimización de PII/PHI, RAG clínico y salida estructurada en formato FHIR con revisión humana.',
            ],
            technologies:
              'TypeScript, Python, Node.js, NestJS, React, PostgreSQL (Postgres), Drizzle ORM, Redis, BullMQ, Docker, Docker Compose, OAuth 2.0, JWT, Redsys, CI/CD, Vitest, Playwright, Zod, OpenAI API, RAG, AI SDK, OCR, FHIR',
          },
          {
            title: 'Director de tecnología (CTO) y Tech Lead',
            subtitle: 'TALKUAL · Remoto',
            period: 'May 2023 — Nov 2025',
            bullets: [
              'Lideré el equipo de ingeniería asumiendo funciones de CTO, definiendo la estrategia trimestral de producto y tecnología, la arquitectura y los procesos de contratación técnica (~1.000 pedidos/día).',
              'Rediseñé el checkout de 8 a 4 pasos reduciendo el abandono en un 40%, e incrementé el AOV y LTV diseñando el módulo de upselling (productos extra a la suscripción) y gestión flexible de pedidos.',
              'Creé el nuevo Design System de la plataforma y migré la tienda y backoffice de Nuxt 2 a Nuxt 3 (Vue.js/TypeScript), implementando la personalización de cajas y el sistema de exclusión de alimentos.',
              'Refactoricé el backend (Strapi/Node.js/PostgreSQL) aplicando DDD, bounded contexts y el patrón Money; optimicé consultas SQL en Metabase y creé suites de pruebas unitarias, de integración y E2E.',
              'Desarrollé la integración con Odoo ERP (contabilidad y fabricación), optimicé la fiabilidad y sincronización con HubSpot CRM, integré pagos Redsys y automaticé despliegues en Heroku con CI/CD.',
            ],
            technologies:
              'TypeScript, Node.js, Vue.js, Nuxt, Strapi, PostgreSQL (Postgres), MongoDB, Odoo, HubSpot, Metabase, Redsys, Heroku, Docker, GitHub Actions, GitLab CI, DDD, Design Systems, Vitest, CI/CD',
          },
          {
            title: 'Senior Product Engineer y Tech Lead',
            subtitle: 'Tuklo (Grupo Mox) · Remoto',
            period: 'Mar 2021 — May 2023',
            bullets: [
              'Co-diseñé y construí la plataforma SaaS 360º (SPOC) con backend en Laravel (PHP) con GraphQL y frontend en Nuxt 2 (Vue.js/TypeScript), traduciendo requisitos operativos complejos en flujos intuitivos para retailers, transporte y almacén.',
              'Desarrollé pipelines de ingesta masiva de paquetería integrando APIs REST/GraphQL (Cainiao, YunExpress, CACESA carga aérea/aduanas) y procesamiento por lotes de ficheros CSV bajo un modelo de dominio común.',
              'Integré redes de taquillas inteligentes (buzones Citibox y lockers Cainiao) para maximizar entregas al primer intento, junto a la optimización algorítmica de rutas (Routific, Google Maps) reduciendo costes por trayecto.',
              'Diseñé una arquitectura serverless orientada a eventos en AWS (Node.js/TS, Lambda, SQS, DynamoDB, Redis, Stripe) con disponibilidad del 99,9%, automatizada con Terraform (IaC), Docker, Kubernetes y CI/CD.',
            ],
            technologies:
              'Laravel, PHP, GraphQL, TypeScript, Node.js, Vue.js, Nuxt, AWS (Lambda, SQS, SES, DynamoDB), Serverless, Arquitectura orientada a eventos (EDA), Terraform, Kubernetes, Docker, Docker Compose, GitHub Actions, GitLab CI, Redis, MySQL, Citibox, Cainiao, YunExpress, CACESA, Routific, Google Maps Platform, Stripe',
          },
          {
            title: 'Ingeniero de software full stack (Consultor externo)',
            subtitle:
              'edata consulting (Proyecto Lufthansa — Cesión desde HYVE) · Remoto',
            period: 'May 2020 — Nov 2020',
            body: 'Software de gestión y mantenimiento de aeronaves para Lufthansa. Colaboración externa mediante cesión de servicios desde HYVE Innovate Digital S.L. junto al equipo de edata consulting para desarrollar soluciones empresariales de alta disponibilidad.',
            bullets: [
              'Desarrollé servicios backend críticos con Java y Spring Boot para la planificación y operativa del mantenimiento de flotas de aeronaves, implementando modelos de dominio limpios y APIs RESTful con un 100% de trazabilidad para auditorías normativas.',
              'Diseñé y optimicé capas de persistencia combinando Oracle Database para transacciones críticas y CouchDB para la sincronización documental distribuida de registros técnicos.',
              'Construí interfaces web empresariales con Angular y TypeScript, facilitando a los equipos técnicos la asignación de órdenes de trabajo, seguimiento de revisiones y cumplimiento de protocolos de seguridad aérea.',
            ],
            technologies:
              'Java, Spring Boot, Angular, TypeScript, Oracle Database, CouchDB, APIs RESTful, Microservicios, Git',
          },
          {
            title: 'Ingeniero de software full stack',
            subtitle: 'HYVE Innovate Digital S.L. · Presencial / Híbrido',
            period: 'Ene 2017 — Mar 2021',
            bullets: [
              'Diseñé y desarrollé la plataforma web, WebSockets e interfaces de ingesta de telemetría IoT en tiempo real para Hörmann, monitorizando ~200 dispositivos en cinco centros logísticos.',
              'Desarrollé aplicaciones web empresariales a medida para clientes internacionales (como la plataforma de comercio Lenogulf y crowdsourcing HYVE Crowd) con PHP, Laravel, Symfony y frameworks JavaScript (React, Vue.js, Node.js).',
              'Refactoricé y mantuve bases de código monolíticas complejas, incrementando la modularidad, cobertura de pruebas y legibilidad del código.',
              'Aprovisioné y automaticé entornos de desarrollo contenerizados y despliegues cloud en AWS mediante Docker, Docker Compose y GitLab CI, reduciendo los ciclos de despliegue en un 40%.',
            ],
            technologies:
              'PHP, Laravel, Node.js, React, Vue.js, Nuxt, Next.js, Express, Symfony, MySQL, MongoDB, Mongoose, AWS, Docker, Docker Compose, GitLab CI, CI/CD, WebSockets, APIs RESTful, Tailwind CSS',
          },
        ],
      },
      {
        title: 'Competencias técnicas',
        kind: 'expertise',
        entries: [
          {
            title: 'Lenguajes',
            body: 'TypeScript, JavaScript (ES6+), Python, Java, PHP, SQL, HTML5, CSS3, Bash / Shell',
          },
          {
            title: 'Backend y APIs',
            body: 'Node.js, NestJS, Express, Spring Boot, APIs RESTful, GraphQL, WebSockets, Laravel, Symfony, procesamiento asíncrono, colas y background jobs (Redis, BullMQ), arquitectura de microservicios, arquitectura limpia (Clean Architecture)',
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
            body: 'Diseño de sistemas (System Design), Domain-Driven Design (DDD), Arquitectura Hexagonal, Arquitectura orientada a eventos (EDA), PostgreSQL (Postgres), Drizzle ORM, MySQL, Oracle Database, CouchDB, MongoDB, DynamoDB, Redis, Row-Level Security (RLS), OAuth 2.0, JWT, 2FA, OWASP, modelado de datos, optimización de consultas SQL',
          },
          {
            title: 'Infraestructura cloud y DevOps',
            body: 'Amazon Web Services (AWS: Lambda, SQS, SES, CloudWatch, S3, IAM, Bedrock), Serverless, Terraform (Infrastructure as Code / IaC), Docker, Docker Compose, Kubernetes, Linux, Cloudflare, pipelines de CI/CD, GitHub Actions, GitLab CI, monitorización con Sentry y GlitchTip',
          },
          {
            title: 'Pruebas automatizadas y metodologías',
            body: 'Desarrollo guiado por pruebas (TDD), Vitest, React Testing Library, Playwright, Jest, pruebas unitarias y de integración, pruebas de extremo a extremo (E2E), contratos HTTP, metodologías ágiles (Agile / Scrum), revisión de código (Code Review), Trunk-Based Development',
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
            links: [
              { label: 'LearningHard', href: 'https://learninghard.dev/' },
            ],
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
        title: 'Educación',
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
        ],
      },
      {
        title: 'Idiomas',
        kind: 'languages',
        entries: [
          {
            title: 'Español (nativo) · Inglés (competencia profesional completa / C1)',
            body: 'Fluidez en comunicación técnica, liderazgo de equipos internacionales y documentación de ingeniería.',
          },
        ],
      },
    ],
  },
}
