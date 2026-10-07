---
title: 'Learning Rust after PHP and TypeScript: who can use your data, and for how long'
published: 2026-10-07
locale: en
translationKey: aprender-rust-despues-de-php-typescript
slug: learning-rust-after-php-typescript
draft: true
description: 'What Rust offers developers working with PHP and TypeScript: ownership, borrowing, and explicit errors, with examples and the reasoning behind each decision.'
author: 'Luis Ramírez Calle'
series: 'Learning other languages from PHP and TypeScript'
tags: ['software-engineering', 'learning', 'php', 'typescript', 'rust']
---

A function receives sales data, calculates a report, and returns. Can it keep that data? Can it change it while another function is reading it? In **PHP** or **TypeScript**, many of these decisions depend on project conventions. **Rust** turns some of them into rules checked by the compiler.

That shift can feel awkward at first: a program that looks reasonable will not compile because it tries to use a value it has already handed to another function. Understanding why is one of the most interesting reasons to learn **Rust**, even if you do not plan to use it in your next job.

In the [Python article](/en/posts/learning-python-after-php-typescript), we transformed sales data. In the [Go article](/en/posts/learning-go-after-php-typescript), we added concurrent queries and controlled when they should finish. Now we will return to that report to see how **Rust** organizes access to data and expresses the cases in which an operation can fail.

## When learning Rust is worth the effort

**Rust** is a compiled, **statically typed** language that manages memory without requiring a **garbage collector**. It combines control over resources with checks that prevent certain classes of memory errors in safe code.

Its [official areas of use](https://rust-lang.org/what/) include command-line tools, **WebAssembly**, network services, and embedded systems. It can also be worth considering for components that process large amounts of data or must work within specific memory limits.

These areas are not exclusive to **Rust**. The question is what constraints the project has and whether its model helps address them. A file-processing tool and a business web application can have very different priorities, even within the same company.

If you work with **PHP** and **TypeScript**, learning it can introduce you to systems programming or to building libraries and tools. But writing a few programs does not replace knowledge of the field: you will also need to learn how to measure, understand the operating system, and use the team's tools.

For a service that spends most of its time waiting for the database, switching to **Rust** can add effort without addressing the main problem. You do not need to rewrite an application to try it, either: a small, standalone tool lets you learn with less risk.

## The same report in TypeScript and Rust

We still have three validated sales. Amounts are integer cents, all sales use the same currency, and we want to sum the paid ones. This time we will calculate an overall total, `4300`, rather than group it by category.

In **TypeScript**, we can separate the calculation from the sample data. Save this program as `report.ts` and run it with `node report.ts` in **Node.js 24**. That execution removes type annotations but does not check them; static analysis is still a job for `tsc`, as the [Node.js documentation](https://nodejs.org/docs/latest-v24.x/api/typescript.html) explains:

```typescript
type Sale = {
  category: string
  amountCents: number
  paid: boolean
}

function totalPaid(sales: readonly Sale[]): number {
  return sales
    .filter((sale) => sale.paid)
    .reduce((total, sale) => total + sale.amountCents, 0)
}

const sales: Sale[] = [
  { category: 'books', amountCents: 2500, paid: true },
  { category: 'courses', amountCents: 5000, paid: false },
  { category: 'books', amountCents: 1800, paid: true },
]

console.log(totalPaid(sales)) // 4300
console.log(sales.length) // 3
```

During type checking, `readonly Sale[]` prevents this function from changing the array's structure through operations such as `push`. It does not make the objects inside it immutable or freeze the data at runtime. The fields of `Sale` remain mutable. The [TypeScript handbook](https://www.typescriptlang.org/docs/handbook/2/objects.html#the-readonlyarray-type) describes this read-only contract.

In **Rust**, we will start with a function that also reads the collection without taking ownership of it. After [installing Rust](https://www.rust-lang.org/tools/install), save this program as `report.rs`, run `rustc --edition=2024 report.rs -o report`, and then run `./report`:

```rust
struct Sale {
    category: String,
    amount_cents: u64,
    paid: bool,
}

fn total_paid(sales: &[Sale]) -> u64 {
    sales
        .iter()
        .filter(|sale| sale.paid)
        .map(|sale| sale.amount_cents)
        .sum()
}

fn main() {
    let sales = vec![
        Sale {
            category: String::from("books"),
            amount_cents: 2500,
            paid: true,
        },
        Sale {
            category: String::from("courses"),
            amount_cents: 5000,
            paid: false,
        },
        Sale {
            category: String::from("books"),
            amount_cents: 1800,
            paid: true,
        },
    ];

    println!("{}", total_paid(&sales)); // 4300
    println!("{}", sales.len()); // 3
    println!("{}", sales[0].category); // books
}
```

`struct` defines each sale's fields, and `vec!` builds a **vector**, a collection that can grow. We use `String` so that each sale owns its category text. The category does not affect the sum, but we keep it to preserve the data used throughout the series.

`&[Sale]` means the function receives a shared reference to a sequence of sales, a **slice**. It can read that sequence without requiring a particular vector or becoming responsible for freeing its data. `&sales` lends that access; after calculating the total, `main` can continue using the collection.

`iter()` walks through references to the sales. `filter` selects the paid ones, and `map` retrieves their amounts. These **iterators** are lazy: they do not create an intermediate vector at each step. `sum` consumes the iterator and produces the total. The [Rust iterator guide](https://doc.rust-lang.org/book/ch13-02-iterators.html) explains this distinction.

We chose `u64`, an unsigned 64-bit integer, because this example only accepts nonnegative amounts. It does not model refunds or guarantee that a sum fits within that range. Later, we will make that possible error explicit. In the **TypeScript** version, we would also need to check that the amounts and the total stay within the safe integer range of `number`.

### Why we specify `--edition=2024`

A **Rust edition** determines which set of language rules the compiler uses. It allows changes, such as new reserved keywords, without forcing every older project to change: each project chooses when to adopt those rules.

The edition is not the **compiler version**. A recent compiler can compile code from different editions. **Rust 2024** is the latest stable edition and has been available since version **1.85.0**, as the [official edition guide](https://doc.rust-lang.org/edition-guide/rust-2024/index.html) records. The number `2024` identifies the edition, not the year in which you run the program.

If you run `rustc report.rs` without specifying an edition, the compiler defaults to **2015**, not the latest one. That is why we write `--edition=2024`: we want the examples to explicitly use that edition's rules. You can check this default in the [rustc documentation](https://doc.rust-lang.org/rustc/command-line-arguments.html#--edition).

With **Cargo**, the edition is specified in the `[package]` section of `Cargo.toml`:

```toml
[package]
name = "sales-report"
version = "0.1.0"
edition = "2024"
```

Then you only need to run `cargo run` or `cargo test`; **Cargo** passes the edition to the compiler. If the `edition` field is missing, **2015** is assumed. In contrast, `cargo new` configures new projects with the latest stable edition. The [Cargo manual](https://doc.rust-lang.org/cargo/reference/manifest.html#the-edition-field) explains both behaviors.

## Ownership: passing a value can mean handing it over

**Ownership** determines who is responsible for a value. For types such as `String`, assigning it to another variable or passing it by value to a function normally transfers that responsibility. This transfer is called a **move**.

This program is deliberately written to produce a compilation error. Save it as `move_error.rs` and check it with `rustc --edition=2024 move_error.rs`:

```rust
fn print_category(category: String) {
    println!("{category}");
}

fn main() {
    let category = String::from("books");
    print_category(category);
    println!("{category}"); // Error: the value has already been moved.
}
```

`print_category` receives the `String` by value. After the call, `main` can no longer use it. The text has not been duplicated, and the two functions have not been left independently responsible for the same resource. The [ownership chapter](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html) develops this model.

Integers such as `u64` behave differently because they implement **Copy**. When you pass one to a function, the function receives a copy of the number: ownership of the original value is not transferred. That is why you can continue using the variable after the call.

This standalone program shows the difference:

```rust
fn print_amount(amount: u64) {
    println!("{amount}");
}

fn main() {
    let amount = 2500_u64;
    print_amount(amount);
    println!("{amount}"); // Still valid: prints 2500.
}
```

Here, both calls can use `amount`. In the earlier `String` example, the first call transferred ownership, so the second could no longer use it. Avoid remembering the rule as “every assignment invalidates the previous variable.”

When an owned value goes out of scope, its destructor normally runs. For `String`, this frees the text's storage. You do not need to call a deallocation function manually. The [reference on destructors](https://doc.rust-lang.org/reference/destructors.html) describes this cleanup and its rules.

The useful question when designing a function becomes: does it need to keep the data, or just read it? In our example, printing a category does not need to consume it.

## Borrowing: reading without taking ownership

We can fix the earlier example through **borrowing**:

```rust
fn print_category(category: &str) {
    println!("{category}");
}

fn main() {
    let category = String::from("books");
    print_category(&category);
    println!("{category}"); // books
}
```

`&str` is a reference to text, not a new `String`. It lets the function accept text stored in a `String` as well as a string literal. Here the function only needs to read, so requiring ownership of the text would be an unnecessary restriction.

The basic borrowing rule allows multiple shared references, `&T`, or one exclusive reference, `&mut T`, while that access is in use. An exclusive reference lets you modify the value, but you cannot simultaneously keep other incompatible access to it. The [chapter on references and borrowing](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html) shows how the compiler checks this.

Imagine one function walking through the sales and another trying to add elements to the same vector. Adding them could require moving its storage to a different memory location. **Rust** prevents combining these accesses when a reference that is still in use could become invalid.

These restrictions differ from **TypeScript**'s `readonly`. They do not just describe what a function can write: they also relate its access to other uses of the same data. Some types have special rules for modifying data through shared references, but we do not need them for this report.

**Lifetimes** complete that check: a reference must not continue to be used after the data it points to no longer exists. The compiler usually infers them. When annotations are necessary, they describe relationships between references; they do not extend the data's life. You can go deeper in the [chapter on lifetimes](https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html).

A common response to a borrowing error is to add `clone()`. Sometimes you need an independent copy, and that is the right decision. But cloning a `String` or a vector has a cost: before doing so, check whether the function only needed to borrow it.

## Result and Option: alternative outcomes are part of the type

So far, we have assumed the sum fits in `u64`. If that assumption fails, the result is no longer reliable. Rather than depending on overflow behavior under a particular build configuration, we can check each addition.

Replace `total_paid` in `report.rs` with this version and add the definition of `ReportError` before it:

```rust
#[derive(Debug, PartialEq)]
enum ReportError {
    TotalOverflow,
}

fn total_paid(sales: &[Sale]) -> Result<u64, ReportError> {
    let mut total = 0_u64;

    for sale in sales.iter().filter(|sale| sale.paid) {
        total = total
            .checked_add(sale.amount_cents)
            .ok_or(ReportError::TotalOverflow)?;
    }

    Ok(total)
}
```

Here we prefer a loop to the earlier chain so that you can see where each addition can fail. `let mut` lets us update the accumulator; variables are immutable by default. `derive` generates implementations for displaying the error during debugging and comparing it in tests.

`checked_add` returns **Option**: `Some(total)` if the sum fits and `None` if it does not. The [checked_add documentation](https://doc.rust-lang.org/std/primitive.u64.html#method.checked_add) specifies this behavior.

`ok_or` converts that absence into a specific error. The `?` operator extracts the successful value or ends the function by returning the error. That is why the signature no longer always promises a number: it returns **Result**, with an `Ok` variant for the total and an `Err` variant for failure.

In `main`, replace only the line that prints `total_paid(&sales)` with this block. The other two lines can stay:

```rust
match total_paid(&sales) {
    Ok(total) => println!("{total}"),
    Err(error) => {
        eprintln!("Could not generate the report: {error:?}");
        std::process::exit(1);
    }
}
```

`match` requires us to account for both variants. Here we have decided that a failed report should write to standard error and exit with a nonzero code. A web service might respond differently. The [Result guide](https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html) also explains how to use `?`.

We could call `unwrap()` to extract the total, but it would trigger a **panic** if there were an error. For a failure we have identified and want to communicate, that is not the policy we want.

**TypeScript** also lets us represent success and failure with **discriminated unions**, and **PHP** can use result objects or exceptions. **Rust** does not invent explicit error handling; it integrates it into the language's conventions and tools.

It does not validate external data for us, either. Being able to represent `u64` does not prove that a sale uses the correct currency or is not duplicated. Those rules remain part of the problem we are solving.

## Testing the report and its limits with Rust

After changing the function, add these tests at the end of `report.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn sale(amount_cents: u64, paid: bool) -> Sale {
        Sale {
            category: String::from("books"),
            amount_cents,
            paid,
        }
    }

    #[test]
    fn sums_only_paid_sales() {
        let sales = vec![sale(2500, true), sale(5000, false), sale(1800, true)];
        assert_eq!(total_paid(&sales), Ok(4300));
    }

    #[test]
    fn returns_zero_without_sales() {
        assert_eq!(total_paid(&[]), Ok(0));
    }

    #[test]
    fn reports_overflow() {
        let sales = vec![sale(u64::MAX, true), sale(1, true)];
        assert_eq!(total_paid(&sales), Err(ReportError::TotalOverflow));
    }
}
```

Run them with `rustc --edition=2024 --test report.rs -o report_tests`, then `./report_tests`. We check the normal calculation, an empty collection, and a limit that does not appear in the sample data.

For a project that will grow, I would use **Cargo**, **Rust**'s build and dependency-management tool. `cargo new sales-report` creates the project; place the program and its tests in `src/main.rs`, run `cargo run`, and check them with `cargo test`. The [introduction to Cargo](https://doc.rust-lang.org/book/ch01-03-hello-cargo.html) explains this structure.

We do not need a class hierarchy to separate responsibilities. The calculation is an independent function, and `main` decides how to present its result. If we later have different sources of sales data, we can introduce an abstraction when that need exists, not before.

## What changes compared with Go's goroutines

In the previous article, we started one **goroutine** per store. In **Rust**, `std::thread::spawn` creates an operating system thread: it is not equivalent to a **goroutine** in cost or scheduling. Creating a thread for every query would not be an appropriate translation for thousands of stores. The [Rust thread guide](https://doc.rust-lang.org/book/ch16-01-threads.html) describes this model.

Type rules also matter when sharing data. **Send** expresses that a type can be transferred between threads; **Sync**, that it can be shared through references between them. The compiler usually derives these properties from the type's components. The [Send and Sync guide](https://doc.rust-lang.org/book/ch16-04-extensible-concurrency-sync-and-send.html) explains these checks.

For many concurrent network operations, **async/await** is commonly used with a runtime such as **Tokio**. A **future** describes work that can advance when the runtime polls it; calling an `async` function does not automatically start a task. This is an important difference from the promises in the **TypeScript** example. The [chapter on futures](https://doc.rust-lang.org/book/ch17-01-futures-and-syntax.html) introduces how this works.

We will not add that runtime to a sum that does not need it. If we turn the report into a program that queries real stores, we will need to decide on concurrency limits, deadlines, and cancellation, as we did in **Go**. The memory model does not choose those policies for us.

## Memory safety does not mean the absence of bugs

In safe code, **Rust** prevents errors such as using a reference to freed memory and helps prevent **data races**, incompatible concurrent accesses to the same memory. That guarantee also depends on libraries that encapsulate `unsafe` code honoring their contracts. The [unsafe Rust guide](https://doc.rust-lang.org/book/ch20-01-unsafe-rust.html) explains where some of that responsibility moves from the compiler to the person writing the code.

The program can still calculate taxes incorrectly, get stuck waiting for a resource, consume too much memory, or execute a business operation twice. **Rust** does not remove the need for tests or design reviews.

We also cannot conclude that it will be faster than **Go**, **PHP**, or **TypeScript** without measuring. Not requiring a garbage collector and being able to control allocations are relevant characteristics for certain requirements, not performance results in themselves. Algorithms, libraries, and external waits still matter.

We have not measured any improvement in this report. If we want to compare performance, we will need representative data, equivalent results, and comparable execution conditions. Adding three sales helps us understand the code, not choose a language for a system.

## What Rust offers even if you keep working with PHP and TypeScript

Practicing with **Rust** can help you ask more precise questions: does this function need to change the data? Who keeps the resource? Is a copy necessary? How do we represent an operation that could not be completed?

You can bring those questions back to **PHP** or **TypeScript** without trying to imitate all of **Rust**'s syntax. For example, reducing shared mutations or representing an expected failure in a function's contract can improve a design in either language.

The extra effort matters, too. Learning **ownership**, reading compiler errors, and getting to know the libraries takes time. One project might benefit from that control, while another prioritizes delivery speed with tools the team already knows. The decision depends on the requirements and the people who will maintain the software.

To continue, turn the report into a tool that reads sales from a file. Start with a small format and add tests for incomplete records, invalid amounts, and overflowing sums. Keep reading separate from calculation so you can test the latter without depending on the disk.

Then try a deliberate change: make a function receive `Vec<Sale>` instead of `&[Sale]` and try to use the sales after the call. Reading the error and deciding whether the function should consume or borrow the data is a more useful exercise than fixing it by blindly adding `clone()`. The [official Rust book](https://doc.rust-lang.org/book/) can help with that next step.
