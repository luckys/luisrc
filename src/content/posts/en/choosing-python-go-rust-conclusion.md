---
title: 'Python, Go, or Rust after PHP and TypeScript: how to choose and which myths to leave behind'
published: 2026-10-08
locale: en
translationKey: elegir-lenguaje-python-go-rust-conclusion
slug: choosing-python-go-rust-conclusion
draft: true
description: 'The series conclusion: strengths, use cases, and limits of Python, Go, Rust, PHP, and TypeScript, with criteria for choosing and common myths explained.'
author: 'Luis Ramírez Calle'
series: 'Learning other languages from PHP and TypeScript'
tags: ['software-engineering', 'learning', 'php', 'typescript', 'python', 'go', 'rust']
---

After trying **Python**, **Go**, and **Rust**, the question “Which language should I learn?” has more possible answers. You can now connect each option to a specific kind of work: investigating data, coordinating services, or controlling how memory is used. Choosing becomes easier when you know what you want to do with what you learn.

Throughout this series, we have built small versions of a sales report. With [Python](/en/posts/learning-python-after-php-typescript), we explored transformations and analysis tools; with [Go](/en/posts/learning-go-after-php-typescript), concurrent queries and cancellation; with [Rust](/en/posts/learning-rust-after-php-typescript), data ownership and explicit errors.

The examples helped us understand decisions. They were not performance benchmarks, and they did not show that we needed to abandon **PHP** or **TypeScript**. To close the series, it helps to separate what each language offers from the expectations we tend to place on it.

## Python: when the work revolves around data

**Python**'s advantages become clear when you need to explore files, combine information, automate tasks, or use scientific tools. **pandas** lets you express operations on tables; **NumPy** provides arrays and numerical computing; **scikit-learn** includes tools for training and evaluating machine learning models. See the [areas where Python is used](https://www.python.org/about/apps/) and the [scikit-learn documentation](https://scikit-learn.org/stable/).

For our report, I would choose it if the next task were investigating why two stores' data does not match: loading their files, finding incomplete records, and checking different explanations. Being able to experiment with those operations within the same ecosystem is a practical advantage.

It is also used for web development and business applications. Associating it only with **artificial intelligence** leaves out plenty of useful work. Integrating an AI model's API does not require **Python**, either: the advantage depends on the libraries and the work you intend to do around that model.

Learning it can bring you closer to teams working on data, automation, or research. To work in those areas, you will need additional knowledge of data quality, statistics, or the problem being studied. Knowing how to call a library is not enough to interpret its results.

### “Python is slow, so it is unsuitable for demanding projects”

This statement mixes the cost of executing code with the usefulness of the whole system. A calculation that loops over millions of elements in **Python** code can become a bottleneck. But an operation written in **Python** can also delegate the work to a native library. The [NumPy documentation on threads](https://numpy.org/doc/stable/reference/thread_safety.html), for example, explains that many of its operations release the **GIL** while they work.

The **GIL** limits **Python** bytecode execution to one thread within a **CPython** interpreter that has it enabled. That does not mean every Python application is unable to use multiple cores: there are separate processes, libraries that release the GIL, and _free-threaded_ builds that allow it to be disabled. Those builds are not the default configuration and require checking dependency compatibility. The [threading documentation](https://docs.python.org/3/library/threading.html#gil-and-performance-considerations) and the [free-threading guide](https://docs.python.org/3/howto/free-threading-python.html) explain these alternatives and their conditions.

Before changing languages, measure which part of the program takes the most time. If most of that time is spent waiting for a database response, speeding up calculations will have little effect on the total. If, instead, the program spends almost all of its time processing data in a loop, it makes sense to review that calculation: improve the algorithm, use a suitable library, or consider implementing it in another language.

## Go: when you need to organize concurrent work and operate services

**Go** combines static types, a broad standard library, and common tools for formatting, testing, and building programs. Its **goroutines** let you organize concurrent tasks, and its interfaces encourage small dependencies defined by behavior.

The [official use cases](https://go.dev/solutions/use-cases) include cloud and network services, web development, command-line tools, and infrastructure. In these areas, deploying and observing a program, and understanding what it does when a dependency fails, often matter as much as writing it.

For the sales report, I would evaluate it if I needed to build a service that queries many stores and combines their responses. The goal would be to control active queries, their deadlines, and how they finish. These needs can arise in retail, logistics, or finance; the industry alone does not determine the language.

The most transferable lesson is thinking about each task's lifetime: who starts it, what data it shares, and how it ends. That reasoning also helps when working with promises in **TypeScript** or processes in **PHP**.

### “Go is faster because it has goroutines”

A **goroutine** lets you organize work; it does not make each operation take less time. If several tasks are waiting for network responses, their waits can overlap. If they perform independent calculations and cores are available, they can execute them in parallel. In both cases, coordination, memory, and synchronization have costs.

Adding more tasks can even make the result worse. The [Go FAQ on parallelism](https://go.dev/doc/faq#parallel) explains why a concurrent program is not guaranteed to perform better.

This capability is not exclusive to **Go**, either. **Node.js** has [worker threads](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html) for distributing calculations across threads. **PHP-FPM** can handle requests using multiple processes. A useful comparison must specify which implementations are being measured, with what resources, and under what load.

### “Since Go is simple, concurrency will be simple too”

Although starting a **goroutine** takes little code, you have to decide how many tasks can run at once, how to communicate their results, and what to do if one fails or takes too long. **Go** provides tools to coordinate that work, but using them correctly requires understanding those problems.

In the **Go** article, we saw that cancellation requires cooperation from the operation and that sending to a channel can get stuck waiting. Mastering that part requires practice with errors and limits, as well as knowing the syntax.

## Rust: when control over resources justifies extra effort

**Rust** offers control over memory without requiring a garbage collector. Its **ownership** and **borrowing** system checks at compile time who can access certain data and for how long. **Result** and **Option** help express failures and missing values within types.

Its [areas of use](https://rust-lang.org/what/) include command-line tools, network services, embedded systems, and **WebAssembly**. It can be a candidate for components where memory consumption, processing, or integration with native code shape the design.

For the report, I would evaluate it if a file transformation consumed too many resources and measurements justified working on that part. First, I would check whether improving the algorithm or processing the data in batches in the current language was enough.

Learning **Rust** also has value when that problem does not exist: it makes you examine which functions need to own data, which only read it, and when you are copying information. The cost is a learning curve that includes memory models, compiler messages, and new design conventions.

### “If it compiles in Rust, it works correctly”

The compiler can reject certain invalid memory accesses; it does not know whether you applied the correct discount to a sale. A program can compile and produce an incorrect report, get stuck waiting for a resource, or charge a customer twice.

The guarantees of safe code also depend on libraries that encapsulate `unsafe` code honoring their contracts. The [chapter on unsafe Rust](https://doc.rust-lang.org/book/ch20-01-unsafe-rust.html) explains that responsibility. Memory safety reduces one class of problems, while tests and design reviews continue to cover others.

### “Rust will always be faster and use fewer resources”

Being able to control memory allocations gives you room to optimize, but you can still make unnecessary copies, choose an expensive algorithm, or keep data you no longer need. The result depends on the program and its dependencies.

You do not have to rewrite an entire application to benefit from a **Rust** component, either. You can isolate an operation, although integration has costs: moving data between components, distributing them, and debugging failures. The measured improvement should justify that work.

## PHP and TypeScript remain options for the next project

Exploring other languages does not make the tools you already know unsuitable. That experience lets you deliver and maintain software with less uncertainty, provided the environment meets the project's needs.

### PHP: web applications and business rules

**PHP** fits web applications, APIs, e-commerce, and business management systems. A team familiar with **Laravel** or **Symfony** can use their tools and conventions to focus on permissions, transactions, and business processes. The [PHP manual](https://www.php.net/manual/en/introduction.php) covers both its web focus and its command-line use.

**“PHP cannot handle work in parallel”** confuses the language with the execution of a request. In **PHP-FPM**, multiple processes can handle requests simultaneously. `pm.max_children` limits that capacity, as the [FPM configuration documentation](https://www.php.net/manual/en/install.fpm.configuration.php) explains.

That does not mean an individual request automatically distributes its calculations across cores. Nor are processes free: a blocking wait occupies a worker. These are constraints to understand, but they do not prove that the language prevents you from building a service that handles many requests.

If the report already belongs to a **PHP** application and meets its requirements, keeping it there avoids introducing another toolchain and another environment to operate. That can be a perfectly reasonable technical decision.

### TypeScript: sharing knowledge between the interface and the server

**TypeScript** brings static checking to the **JavaScript** ecosystem. In web applications, it lets you work with related conventions and types across the frontend and backend, while improving code navigation and refactoring. Its [handbook](https://www.typescriptlang.org/docs/handbook/intro.html) describes that role.

**“If it is typed in TypeScript, the data is already validated”** is a particularly dangerous misconception. Annotations are removed and do not, by themselves, check an HTTP response or a JSON file. Sharing a type between client and server describes a contract, but does not verify that received data satisfies it. The [section on type erasure](https://www.typescriptlang.org/docs/handbook/2/basic-types.html#erased-types) explains this behavior.

**“An async function runs its calculations on another thread”** is also incorrect. In the series example, `async` let us wait without blocking on that wait, but the calculation still ran on the thread handling it. For CPU-intensive work, you need to decide how to distribute it, for example through workers. The [Node.js guide to the event loop](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop) explains how those calculations can delay other tasks.

For a product with substantial browser interaction and a backend that integrates services, staying with **TypeScript** can simplify the team's work. Choosing a runtime, such as **Node.js** or **Bun**, is part of that decision: the language alone does not describe how the service will behave.

## A guide to choosing based on the next problem

This table offers starting points, not boundaries between languages. The alternatives can solve several of the same problems.

| If your next task is…                                                 | Consider evaluating…                                    | Before deciding, check…                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| Investigating files and discrepancies in data                         | **Python** and its analysis ecosystem                   | Data quality, available libraries, and memory requirements                |
| Coordinating queries to many stores                                   | **Go** or your current environment's asynchronous model | Connection limits, cancellation, and resources under load                 |
| Reducing the cost of an intensive transformation                      | **Rust**, after locating the bottleneck                 | The algorithm, integration cost, and improvement with representative data |
| Adding the report to a business application in PHP                    | **PHP** with the team's existing tools                  | Queries, workload, and whether it needs to run in the background          |
| Integrating the report into a web product with a frontend and backend | **TypeScript**                                          | Input validation and separating expensive calculations                    |

There is an important difference between choosing for **learning** and choosing for **production**. For learning, an interest in the model is enough. To introduce it into a product, you also need to consider who will maintain it, how it will be deployed, and which dependencies it needs.

Using all five languages in the report would be a possible exercise, but that alone would not make it an architecture I would recommend. Each additional environment requires updates, diagnosis, and operational knowledge. A small application can meet all its needs with a single choice.

## Changing languages can guide your career, but it needs a goal

If you want a different kind of work, start by identifying which activities interest you. **Python** can support a path toward data or automation; **Go**, toward services and infrastructure; **Rust**, toward systems and components where control over resources matters. None guarantees a job just because you master its syntax.

Review job postings in the field and location that interest you. Look at the knowledge listed alongside the language: databases, networking, statistics, operating systems, or experience operating services. That information lets you prepare a project that demonstrates relevant skills, without inferring opportunities from a technology's popularity.

If your goal is to broaden your knowledge, curiosity can guide your choice. What matters is being able to explain why you borrow data, limit active tasks, or validate an input. That judgment remains useful when you return to **PHP** or **TypeScript**.

To finish the series, choose one version of the report and give it a real requirement: reading a troublesome file, querying stores within a deadline, or processing more data within a memory budget. Write down what you expect to achieve, add failure cases, and check the result.

Then leave a brief note explaining what you would choose to maintain that program and why. Include the cost of learning, testing, and operating it, as well as how it works. You will have a decision based on concrete experience and a clearer next step than starting another tutorial just to add a language to the list.
