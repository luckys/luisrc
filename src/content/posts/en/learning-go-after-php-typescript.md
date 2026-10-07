---
title: 'Learning Go after PHP and TypeScript: concurrency is not the same as parallelism'
published: 2026-10-07
locale: en
translationKey: aprender-go-despues-de-php-typescript
slug: learning-go-after-php-typescript
draft: true
description: 'What Go offers developers working with PHP and TypeScript: types, errors, and goroutines, with comparable examples and their limits.'
author: 'Luis Ramírez Calle'
series: 'Learning other languages from PHP and TypeScript'
tags: ['software-engineering', 'learning', 'php', 'typescript', 'go', 'concurrency']
---

A report that queries three services does not have to wait for one to finish before starting the next. You can overlap those queries with **TypeScript** and with **Go**. So what changes when you learn **Go** if you already know how to work with asynchronous code?

The difference is not discovering that several tasks can make progress at once. It is learning another model for organizing them, communicating their results, and controlling when they should finish. That model is useful for building services, **infrastructure** tools, and programs that combine many independent operations.

In the [first article, about Python](/en/posts/learning-python-after-php-typescript), we used a sales report to compare ways of transforming data. We will return to that small project: first we will calculate the same totals, then imagine that the sales come from different stores.

## When learning Go makes sense

**Go** is a compiled, **statically typed** language. Its toolchain includes tools for formatting, testing, and building programs, and a **standard library** that supports tasks such as working with **HTTP** or parsing **JSON**.

Its [official use cases](https://go.dev/solutions/) include cloud services, command-line tools, and web development. If you are interested in **backend** development, **infrastructure**, or tools used by other developers, that direction is worth exploring. These are kinds of work, not industries exclusive to a language: a financial company and an e-commerce platform may need similar services.

That does not make **Go** a necessary replacement for **PHP** or **TypeScript**. If an application works well with **Laravel**, or you need to share knowledge and tools between a frontend and a **Node.js** backend, switching languages has a cost you need to justify.

You can also learn it without considering a migration. Building a small tool in **Go** lets you revisit how you organize types, handle errors, and think about tasks that share data.

## From TypeScript to Go: the same data, different conventions

We return to the three sales from the **Python** article. The data has already been validated, amounts are integer cents, and all sales use the same currency. We want to add up only the paid sales.

In **TypeScript**, the complete example would be:

```typescript
type Sale = {
  category: string
  amountCents: number
  paid: boolean
}

const sales: Sale[] = [
  { category: 'books', amountCents: 2500, paid: true },
  { category: 'courses', amountCents: 5000, paid: false },
  { category: 'books', amountCents: 1800, paid: true },
]

const totals = new Map<string, number>()

for (const sale of sales) {
  if (!sale.paid) continue
  const previous = totals.get(sale.category) ?? 0
  totals.set(sale.category, previous + sale.amountCents)
}

console.log(Object.fromEntries(totals)) // { books: 4300 }
```

In **Go**, we can use a struct, a **slice** for the sales, and a map to accumulate the amounts. Save this program as `report.go` and run it with `go run report.go`, after [installing Go](https://go.dev/doc/install):

```go
package main

import "fmt"

type Sale struct {
	Category    string
	AmountCents int64
	Paid        bool
}

func main() {
	sales := []Sale{
		{Category: "books", AmountCents: 2500, Paid: true},
		{Category: "courses", AmountCents: 5000, Paid: false},
		{Category: "books", AmountCents: 1800, Paid: true},
	}

	totals := make(map[string]int64)
	for _, sale := range sales {
		if !sale.Paid {
			continue
		}
		totals[sale.Category] += sale.AmountCents
	}

	fmt.Println(totals["books"]) // 4300
}
```

A **slice** is a view of a sequence of elements in an underlying array, with a length and a capacity. Here it serves as our collection of sales. We do not need to master how it grows or shares memory yet, but that will matter before assuming that copying a **slice** copies all its elements.

`:=` declares a variable and infers its type. It does not make the program dynamically typed: `totals` is still a map from strings to 64-bit integers. Looking up a missing key in that map returns the type's zero value, `0`, so we can add amounts without writing the equivalent of `?? 0`.

We chose `int64` to express that we are working with integer amounts, not decimals. This is not a complete solution for handling money either: the representation has a limit, and a real report should check that sums do not exceed it. In **TypeScript**, we would also need to consider the safe integer range of `number`.

The most interesting difference is not the number of lines. **Go** uses structs and methods, but does not offer **class inheritance**. To reuse behavior, you use functions, **composition**, and **interfaces**.

Types satisfy **interfaces** by having the required methods, without an `implements` declaration as in **PHP**. This encourages defining dependencies by what they need to do, although you can also design small **interfaces** in your current languages. The [Go FAQ](https://go.dev/doc/faq) explains this type system based on **composition**.

## Concurrency does not mean running everything in parallel

**Concurrency** means organizing tasks that can make progress during overlapping periods. One might wait for a network response while another starts its work. **Parallelism** means executing work simultaneously, for example on different **CPU** cores.

Think about our report. If you query one store, wait for its response, and then query the next, you are working sequentially. If you start all three queries before waiting for their results, their waits can overlap. You do not need three cores to take advantage of that waiting time.

In **Node.js**, `async` and `await` let you express asynchronous operations, and `Promise.all` lets you wait for several results. But declaring a function `async` does not move its calculations to another thread. An expensive transformation running on the **event loop** thread can prevent other tasks from being handled. The [Node.js guide to the event loop](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop) explains this problem.

In **Go**, a **goroutine** is a task whose execution is managed by the language's **runtime**. You start it with `go`, and the **runtime** distributes **goroutines** across operating system threads. There is no dedicated thread for each **goroutine**. Depending on resources and configuration, several can execute work in parallel; there is no guarantee that each task gets its own core. [Effective Go](https://go.dev/doc/effective_go#goroutines) explains this model.

That is why saying that “**Go** has **concurrency** and **TypeScript** does not” would be incorrect. What changes is the execution model and the tools for coordinating it. Nor can we conclude that a program will be faster just because it uses **goroutines**: we need to measure the actual workload.

## Querying several stores with Promise.all

Now each store returns a total for paid sales. We will use `2500`, `0`, and `1800` cents, equivalent to the earlier sales. The store with the unpaid sale returns zero.

To run the example without external services, we will simulate each query with a 50-millisecond wait. The data is defined in the program: we are not implementing an **HTTP** request, response validation, or a performance test.

This example is independent of the previous one. With **Node.js 24**, you can save it as `stores.ts` and run `node stores.ts`. Built-in support removes the annotations but does not check types: running the file does not replace checking it with `tsc`, as the [Node.js TypeScript documentation](https://nodejs.org/docs/latest-v24.x/api/typescript.html) explains.

```typescript
type Store = {
  name: string
  paidCents: number
}

const stores: Store[] = [
  { name: 'north', paidCents: 2500 },
  { name: 'central', paidCents: 0 },
  { name: 'south', paidCents: 1800 },
]

async function fetchPaidTotal(store: Store): Promise<number> {
  await new Promise<void>((resolve) => setTimeout(resolve, 50))
  return store.paidCents
}

async function main(): Promise<void> {
  const amounts = await Promise.all(stores.map(fetchPaidTotal))
  const total = amounts.reduce((sum, amount) => sum + amount, 0)
  console.log(total) // 4300
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
```

`map` calls `fetchPaidTotal` for each store, starting all three waits before `Promise.all` waits for their results. If we had used an `await` inside a loop for each query, the waits would be sequential.

`Promise.all` rejects its promise if one operation fails, but does not automatically cancel the others. With real requests, you would need to decide whether to stop them, for example by using **AbortController** with an API that supports its signal. This example does not include **cancellation**; the next version introduces it to explain how it works in **Go**.

## The same query with goroutines and a channel

In **Go**, we can start one **goroutine** per store and collect results through a **channel**, a tool for sending values between **goroutines**. We will add a one-second deadline so the operation does not wait indefinitely.

Save this independent program as `stores.go` and run it with `go run stores.go`:

```go
package main

import (
	"context"
	"fmt"
	"os"
	"time"
)

type Store struct {
	Name      string
	PaidCents int64
}

type Result struct {
	AmountCents int64
	Err         error
}

func fetchPaidTotal(ctx context.Context, store Store) (int64, error) {
	timer := time.NewTimer(50 * time.Millisecond)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return 0, ctx.Err()
	case <-timer.C:
		return store.PaidCents, nil
	}
}

func totalPaid(ctx context.Context, stores []Store) (int64, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Each task sends once, even if we stop collecting results.
	results := make(chan Result, len(stores))
	for _, store := range stores {
		go func(store Store) {
			amount, err := fetchPaidTotal(ctx, store)
			results <- Result{AmountCents: amount, Err: err}
		}(store)
	}

	var total int64
	for range stores {
		select {
		case <-ctx.Done():
			return 0, ctx.Err()
		case result := <-results:
			if result.Err != nil {
				return 0, result.Err
			}
			total += result.AmountCents
		}
	}
	return total, nil
}

func main() {
	stores := []Store{
		{Name: "north", PaidCents: 2500},
		{Name: "central", PaidCents: 0},
		{Name: "south", PaidCents: 1800},
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	total, err := totalPaid(ctx, stores)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println(total) // 4300
}
```

The results flow through a single collection point:

```text
goroutine: north store   ─┐
goroutine: central store ─┼─> results channel ─> totalPaid adds the amounts
goroutine: south store   ─┘
```

There is more code than in the `Promise.all` version, partly because we added a deadline and **cancellation**. It would not be fair to attribute the entire difference in size to the language. What matters is understanding the decisions:

- Each **goroutine** queries a store and sends a result. It does not directly modify the shared total.
- The **goroutine** running `totalPaid` is the only one that adds the amounts. This avoids several tasks writing to the same accumulator without synchronization.
- The channel has room to hold one result per store. If `totalPaid` exits because of an error and stops collecting results, the other **goroutines** can still leave theirs in the channel and finish. They do not get stuck waiting for someone to receive them.
- `context` communicates **cancellation**, but does not automatically stop the code a **goroutine** is executing. It is a signal that says, “we no longer need this work.” In our example, `fetchPaidTotal` uses `select` to wait for either the timer to finish or that signal to arrive. If it detects cancellation, it stops waiting and returns an error; the **goroutine** sends that result to the channel and finishes. If the function did not check the signal, it would keep working even after we called `cancel()`.
- We do not close the channel because we collect a known number of results. Closing a channel is not required to release its resources; it indicates that there will be no more sends.

Returning on an error discards the partial total and cancels the queries' context. The function does not wait for all **goroutines** to finish before returning; in this simulation, they can finish without blocking because the wait supports **cancellation** and the channel has room. If a resource required waiting for all tasks to shut down, we would need to coordinate that completion too.

For a real **HTTP** query, you would pass the context to the request, for example with `http.NewRequestWithContext`, and handle the response and close its body. A context does not fix a function that ignores **cancellation**. The [context documentation](https://pkg.go.dev/context) explains this contract.

## What goroutines do not solve for you

Creating one **goroutine** per store works for this three-item example. Doing it for a hundred thousand stores can exhaust connections, consume memory, or exceed a provider's limits. A **goroutine** has a cost, even though it is not a dedicated thread.

As the volume grows, you will need to limit active work, for example with a fixed number of workers processing tasks. In **TypeScript**, launching thousands of requests with `Promise.all` creates a similar problem: you need to control **concurrency**, not just know how to start it.

You also need to decide what a failure means. Our report requires every store to respond, so it does not return a partial total. Another product might display incomplete results and identify the missing stores. That is a business decision, not a property of **Go**.

If several **goroutines** share and modify a map or variable, you need to coordinate access using **channels**, a **mutex**, or another suitable tool. The [official article on pipelines and cancellation](https://go.dev/blog/pipelines) shows how a blocked send can leave tasks unable to finish. Learning **Go** includes recognizing these problems, not just adding `go` before a call.

## When Go can offer better performance than TypeScript or PHP

The association between **Go** and good performance has a technical basis, but combines several distinct advantages: compiled code execution, lightweight tasks, and the ability to use multiple cores. Using **goroutines** does not improve all three by itself.

Also, when we discuss **TypeScript** performance, we are comparing programs running in a specific environment. **Node.js** uses **V8**, and **Bun** uses **JavaScriptCore**. The same code can behave differently depending on the engine, libraries, and APIs used. The [Node.js](https://nodejs.org/learn/getting-started/the-v8-javascript-engine) and [Bun](https://bun.sh/docs/runtime) documentation explains these engines.

We write the program in **TypeScript**, but its types are removed and the code runs as **JavaScript**. That is why we refer to **TypeScript** when discussing the code we write, and **JavaScript** when describing the engines that execute it. The [Node.js TypeScript documentation](https://nodejs.org/docs/latest-v24.x/api/typescript.html#type-stripping) explains this type stripping.

### When the work involves calculating, not waiting

Imagine our report no longer adds three amounts, but applies calculation rules to millions of independent sales. If you run those rules in a loop on the **Node.js** main thread, that thread will be busy calculating and unable to handle other **event loop** tasks until it finishes. Wrapping the loop in an `async` function does not change that.

In **Go**, you can split the sales into batches and process them with a limited number of **goroutines**. If multiple cores are available, the **runtime** can execute those batches in parallel. Compared with a version that performs all calculations on one thread, there is a concrete opportunity to finish sooner. The improvement depends on how much work is independent and how much it costs to distribute it and combine the results. The [Go FAQ on parallelism](https://go.dev/doc/faq#parallel) also explains why adding tasks can slow a program down.

That does not mean **Node.js** or **Bun** cannot do this. **Node.js** has [**worker threads**](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html), and **Bun** offers [**Workers**](https://bun.sh/docs/runtime/workers), which run another JavaScript instance on a separate thread. They also let you distribute calculations across cores. Bun's documentation notes that its Workers API is still experimental, particularly worker termination.

The advantage of **Go** here is that **goroutines** are part of the language's regular model and share the process's memory space. You do not need to create a JavaScript instance for each task. That can make distributing work less expensive, but sharing memory requires synchronization. Workers do not always require copying all data either: **Node.js**, for example, allows buffers to be transferred or shared. A fair comparison must include these alternatives.

### When a service mixes networking and processing

Let us return to the stores. While we only wait for their responses, the asynchronous model in **Node.js** already lets us take advantage of those waits. The situation changes if each response then requires an expensive calculation written in **TypeScript** that runs on the main thread: that processing can also delay other requests to the service.

**Go** can distribute that work across cores within the same process using **goroutines**. This makes it an interesting candidate for services that combine many connections with independent processing. It does not eliminate saturation: if all cores are busy, you need to limit work and manage the queue of pending tasks. In **Node.js** or **Bun**, moving those calculations to workers also prevents them from blocking the main thread. The [Node.js guide to blocking](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop) discusses this problem.

### Where the comparison with PHP comes from

In a typical **PHP-FPM** deployment, different processes handle different requests. A **PHP** application can therefore handle requests in parallel and use multiple cores. The [FPM configuration](https://www.php.net/manual/en/install.fpm.configuration.php) sets the limit on simultaneous requests through `pm.max_children`.

If a request makes a blocking query and waits, it keeps one of those processes occupied. A **Go** service can organize many waits through lightweight tasks, without needing a whole process for each one. When available processes and their memory consumption are the limiting factor, that change in model can allow more work to be handled with the same resources. It is a reason to evaluate **Go**, not a guarantee for every application.

Not all **PHP** runs this way either. There are libraries and extensions for asynchronous operations and long-running servers. The language includes [**Fibers**](https://www.php.net/manual/en/language.fibers.php), which allow functions to be suspended and resumed, although they do not distribute calculations across cores by themselves. Comparing **Go** with **PHP-FPM** and applying the result to every **PHP** environment would be misleading.

### A goroutine does not make the calculation inside it faster

**Go** compiles the program to machine code before executing it. That feature is separate from its support for **concurrency**. JavaScript engines can also compile and optimize code during execution; summarizing the comparison as “compiled versus interpreted” would not be accurate. The documentation for the [Go runtime](https://go.dev/doc/faq#runtime) and [V8](https://nodejs.org/learn/getting-started/the-v8-javascript-engine) explains these models.

A transformation may be faster in **Go**, but we cannot deduce that from the language alone: the algorithm, data representation, memory allocations, and libraries matter. An operation handled by a native library from **Node.js**, **Bun**, or **PHP** is not equivalent to performing all its work in application code either.

Before migrating our report, we would measure response time, reports completed per second, and **CPU** and memory usage. We would use the same data, resources, and concurrency limits, check that results are equivalent, and test under sustained load rather than with a single isolated request. We would also look at **p95 latency**, the time within which 95% of requests complete, so an acceptable average does not hide slow responses.

If time is spent on a poorly designed query or waiting for an external API, switching to **Go** does not fix that problem. If it is spent on calculations we can distribute, or on keeping too many processes occupied while waiting, we have a concrete hypothesis to test. That is a more useful justification than “Go is faster because it has goroutines.”

## What Go adds to your engineering judgment

Part of the learning involves treating errors as explicit results. In `fetchPaidTotal`, `(int64, error)` indicates that the function returns an amount and a possible error. The code calling `fetchPaidTotal` decides what to do with the error; it does not have to discover that case by reading an exception thrown in another layer. The [official error-handling tutorial](https://go.dev/doc/tutorial/handle-errors) demonstrates this pattern.

That does not prevent errors from being ignored or guarantee good design. You can return them without context or repeat checks that do not help. The useful practice is deciding where to recover from an error, where to add information, and when to return it so the code that called the function can handle it. You can apply that judgment when you return to **PHP** or **TypeScript** too.

Another part involves managing tasks with a defined lifetime: who starts them, when they finish, what happens if a dependency fails, and who modifies shared data. **Goroutines** make these questions visible, but the questions matter in any concurrent system.

You will also need to learn about modules, tests, performance profiling, and tools such as `gofmt`. If you want to work in **infrastructure**, add networking, operating systems, and **observability** to that list. Knowing how to write a **goroutine** is not the same as knowing how to operate a production service.

## A next step for the sales report

Start by running the examples, then replace the simulated wait with two local **HTTP** services. Keep a limit on simultaneous queries and define a deadline for the whole operation. Do not add retries until you decide which errors are recoverable and which requests are safe to repeat.

Test an empty list, a slow store, an invalid response, and **cancellation**. Also check that a failure does not leave queries waiting indefinitely. You can use `go test -race` to look for **data races** during tests, although not finding them does not prove they do not exist. The [race detector documentation](https://go.dev/doc/articles/race_detector) explains its limits.

If you enjoy that work, you will have a clue about whether you want to go deeper into services and **infrastructure**. If exploring and comparing data interested you most, you can continue along the **Python** path from the first article. You do not need to choose one permanently.

In the next article, we will discuss **Rust**. We will return to types and errors, but add a question that **Go** largely handles through its **garbage collector**: who owns the data, and how long can it be used?
