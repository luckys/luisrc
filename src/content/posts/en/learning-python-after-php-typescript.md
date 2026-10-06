---
title: 'Learning Python after PHP and TypeScript: what changes and when it is worth it'
published: 2026-10-06
locale: en
translationKey: aprender-python-despues-de-php-typescript
slug: learning-python-after-php-typescript
draft: true
description: 'What Python offers developers working with PHP and TypeScript: differences, code examples, and a way into data analysis and automation.'
author: 'Luis Ramírez Calle'
series: 'Learning other languages from PHP and TypeScript'
tags: ['software-engineering', 'learning', 'php', 'typescript', 'python']
---

After years of working with the same languages, you know their tools, their limitations, and the usual ways to solve problems. That familiarity makes everyday work easier, but it can also spark an interest in other ways of building software.

For an engineer working with **PHP** and **TypeScript**, when does learning **Python** make sense? What can it offer beyond different syntax?

You do not have to leave what you know behind to explore another direction. But there is a difference between learning a language out of curiosity and preparing to work with it professionally. Both are valid reasons; what changes is how deeply you need to learn and how much time you will need to spend.

This is the first article in a series that will continue with **Go** and **Rust**. In each article, we will compare solutions with **PHP** or **TypeScript** to understand what changes, why it might be useful, and what effort it requires. We start with **Python**, using a small sales report as our example.

## What you want to learn and what kind of work interests you

Before choosing another language, it helps to clarify what you are looking for: access to different projects, a move into another field, or a way of programming that challenges your habits.

That intention helps you choose. Working with data is not the same goal as building infrastructure tools or understanding memory management better.

Learning another language can also help you reconsider your habits. For example, a solution built around a class hierarchy may make sense in one project and be unnecessary in another. Understanding another language's conventions helps you distinguish decisions that address the problem from those you have adopted out of habit.

And not everything has to become a career plan. Curiosity is a good enough reason. Finishing a small tool and discovering another way to organize code can make the effort worthwhile, even if you never change jobs.

## Your PHP and TypeScript experience still matters

When you switch languages, you will need to learn syntax, tools, and conventions. You will not need to learn from scratch what a transaction is, how to design an **API**, or why testing an error case is useful.

Your experience solving problems, reading other people's code, and maintaining systems remains valuable. What does not transfer automatically is knowledge of the new environment: its libraries, deployment practices, limitations, and common problems.

Having experience does not mean you will immediately master a new language. You will have to learn its conventions and will make mistakes, but you will bring judgment to analyzing problems, weighing alternatives, and understanding the consequences of your decisions. That experience remains useful while you learn.

You do not need to change languages to keep growing. Learning more about databases, security, or software design within your current environment can also be a good next step. Learning **Python** is worthwhile when it offers something you are interested in, not as proof that you have reached a particular level.

Data analysis, automation, and building services are not exclusive to **Python**, either. The differences lie in the available libraries, tools, and constraints you will work with. Those are worth comparing, not just what each language's syntax lets you write.

## Python: exploring data analysis and automation

**Python** can be a good choice if you want to explore data analysis, scientific computing, or automation. It is also used for web applications and development tools, as the [Python Software Foundation](https://www.python.org/about/apps/) describes. For machine learning, libraries such as [scikit-learn](https://scikit-learn.org/stable/) provide tools for training and evaluating models.

If you come from **PHP**, parts of the experience will feel familiar: you can run code without an explicit compilation step and work with dynamic types. The new part does not have to be that characteristic; it may be the libraries and the way you approach the work.

Imagine you want to investigate why two sales reports disagree. You will need to read files, compare records, and decide what to do with incomplete data or inconsistent formats. You can do that with **PHP** or **TypeScript**. The reason to try **Python** is to learn how to solve it with its data analysis ecosystem, which includes tools such as **pandas**.

That work develops an important skill: checking whether the data supports a conclusion before building a feature around it.

## Filtering and transforming data: from TypeScript to Python

Suppose we have sales records that have already been validated, and we want the amounts of the paid sales. We use integer cents and a single currency to avoid introducing monetary calculations with decimal fractions. We are not showing how to validate or read a file yet.

In **TypeScript**, we can filter and transform an array:

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

const paidAmounts = sales.filter((sale) => sale.paid).map((sale) => sale.amountCents)

console.log(paidAmounts) // [2500, 1800]
```

In **Python**, we can express the same transformation with a **list comprehension**, an expression that builds a new list by transforming or filtering the elements of another collection:

```python
from typing import TypedDict


class Sale(TypedDict):
    category: str
    amount_cents: int
    paid: bool


sales: list[Sale] = [
    {"category": "books", "amount_cents": 2500, "paid": True},
    {"category": "courses", "amount_cents": 5000, "paid": False},
    {"category": "books", "amount_cents": 1800, "paid": True},
]

paid_amounts = [sale["amount_cents"] for sale in sales if sale["paid"]]

print(paid_amounts)  # [2500, 1800]
```

`TypedDict` describes the keys and values we expect in each dictionary for type-checking tools. It does not create an object with automatic validation. The annotations help us read and check the code, as we will see in the next section.

The useful difference is not that one version takes fewer lines. The comprehension combines filtering and transformation in an expression that is common in **Python**, while in **TypeScript** we have chained two operations. Both are readable to someone familiar with their conventions. If the transformation grows, it is better to extract functions or use a loop than to fit every rule into one expression. The [Python data structures tutorial](https://docs.python.org/3/tutorial/datastructures.html) explains comprehensions.

## Type annotations do not validate external input

**Python** lets you add type annotations and use static analysis tools, but the interpreter does not enforce those annotations at runtime, as the [typing documentation](https://docs.python.org/3/library/typing.html) explains.

This also happens in **TypeScript**: its annotations are erased and do not, by themselves, validate the data entering your program. The [TypeScript handbook](https://www.typescriptlang.org/docs/handbook/2/basic-types.html) explains this. In both cases, we need to distinguish static type checking from validating external input.

For example, imagine you receive an age in **JSON** format. You expect a number, but the data contains the string `"36"`. We simplify the input to a single value to focus on what the annotation does.

In **Python**, this code runs without rejecting the value:

```python
import json

age: int = json.loads('"36"')

print(age)                 # 36
print(type(age).__name__)  # str
```

Although we wrote `age: int`, the variable holds a string. `json.loads` parses the **JSON**, but does not check whether the result matches our annotation. Because its result is typed as `Any`, a static type checker may allow this assignment: it has no guarantee about the type of the received value.

Something equivalent happens in **TypeScript**:

```typescript
const age: number = JSON.parse('"36"')

console.log(age) // 36
console.log(typeof age) // string
```

`JSON.parse` also returns a value typed as `any`, so this assignment can compile even with strict mode enabled. The `number` annotation does not turn the string into a number or add a check to the **JavaScript** that will run.

To reject that value, we need to check it at runtime. In **Python**, we can do this in a function that validates the value before returning it:

```python
import json


def parse_age(value: object) -> int:
    if type(value) is not int:
        raise ValueError("Age must be an integer")
    return value


print(parse_age(json.loads('36')))    # 36
print(parse_age(json.loads('"36"')))  # Raises ValueError
```

Here we use `type(value) is int` to avoid accepting a boolean as an integer, which would happen with `isinstance(value, int)` in **Python**.

In **TypeScript**, `unknown` expresses that we do not yet trust the type of the value. The function checks it before returning a `number`:

```typescript
function parseAge(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error('Age must be an integer')
  }
  return value
}

console.log(parseAge(JSON.parse('36'))) // 36
console.log(parseAge(JSON.parse('"36"'))) // Throws Error
```

The **TypeScript** condition also checks that the integer is within the range **JavaScript** can represent precisely. We have not yet validated whether the age makes sense for our application, for example, whether it can be negative. That would be a separate rule. These examples only show that describing the expected type and checking the received value are different tasks.

## Grouping sales: when the ecosystem starts to matter

Using the same sales as in the first example, we want to sum the paid amount by category. In **TypeScript**, we can iterate over them and accumulate the results in a `Map`. This block continues the earlier example and uses its `sales` variable:

```typescript
const totals = new Map<string, number>()

for (const sale of sales) {
  if (!sale.paid) continue
  const previous = totals.get(sale.category) ?? 0
  totals.set(sale.category, previous + sale.amountCents)
}

console.log(Object.fromEntries(totals)) // { books: 4300 }
```

In **Python**, we can also do this without installing any libraries. This block uses the `sales` list from the first Python example:

```python
totals: dict[str, int] = {}

for sale in sales:
    if not sale["paid"]:
        continue
    category = sale["category"]
    totals[category] = totals.get(category, 0) + sale["amount_cents"]

print(totals)  # {'books': 4300}
```

For these three records, both solutions are sufficient. There is no need to add a dependency to sum two amounts.

If the report starts needing grouping by multiple columns, joins between files, or date handling, **pandas** becomes worth exploring. Its main structure, the `DataFrame`, lets you work with data organized into rows and columns. The following example is independent of the earlier ones and requires installing the library.

You can do this in a virtual environment, which keeps the project's dependencies separate from those of other projects. On Linux or macOS:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install pandas
```

On Windows, the equivalent executable is `.venv\Scripts\python.exe`. The [venv documentation](https://docs.python.org/3/library/venv.html) explains the platform differences. Save the following code as `report.py` and run it with `.venv/bin/python report.py`:

```python
import pandas as pd

sales = pd.DataFrame([
    {"category": "books", "amount_cents": 2500, "paid": True},
    {"category": "courses", "amount_cents": 5000, "paid": False},
    {"category": "books", "amount_cents": 1800, "paid": True},
])

paid_sales = sales.loc[sales["paid"]]
totals = paid_sales.groupby("category")["amount_cents"].sum()

print(totals.to_dict())  # {'books': 4300}
```

First, we select the paid rows. Then we group by category and sum the amounts column. These are selection and aggregation operations on a table, rather than an accumulator we update on each iteration. The [pandas summary statistics tutorial](https://pandas.pydata.org/docs/getting_started/intro_tutorials/06_calculate_statistics.html) explains this kind of grouping.

The advantage is having those operations available and combining them with other analysis tools, not that **Python** is the only language that can do this. An **SQL** query or a **JavaScript** library could be suitable options, depending on where the data lives and what the team uses.

We have not demonstrated that one version is faster, either. These examples compare ways to express the work, not performance. In a real report, we would need to validate the columns, decide how to handle missing values, and account for the limits of numeric types. If the data does not fit in memory, loading everything into a `DataFrame` may not be a good solution.

## What Python offers and what you will need to learn separately

Practicing with **Python** can expand your repertoire with comprehensions, dictionaries, and tools for working with data. That does not require giving up classes or mean that everything should be solved with functions. What matters is learning the environment's conventions and choosing a structure that makes the program easy to understand.

You will also need to get familiar with virtual environments, dependency management, and testing and static analysis tools. These tasks are comparable to what you already do with **Composer** or tools in the **TypeScript** ecosystem, but with different conventions.

If you want to move toward data or machine learning, the language will only be part of the change. Depending on the role, you will need to learn more about **SQL**, statistics, data quality, or model evaluation. Knowing how to run a library is not the same as knowing how to interpret its output.

If you simply want to keep building web applications similar to those you already maintain, it helps to be specific about what you hope to gain: a library you need, working with a team that uses Python, or learning another approach. Rewriting a working application just to change languages introduces work and risks that also need to be considered.

## A first project to see whether this direction interests you

A sales reporting tool can start by reading a **CSV**, rejecting incomplete records, and calculating totals by category. Keep a single currency and document the format of the amounts. Write tests for an empty file, an invalid amount, and an unpaid sale, not just the example that produces the expected result.

Then add a concrete requirement: comparing two files or grouping by month. That extension will help you decide whether the standard library is still enough or whether **pandas** offers something that justifies the dependency.

If your goal is professional, compare what you have learned with job listings for roles that interest you. Identify which skills recur and which ones you still need. You do not need to stop working with **PHP** or **TypeScript** while exploring this direction.

The next article will focus on **Go**: we will compare asynchronous tasks in **TypeScript** with goroutines, distinguishing the wait for network operations from CPU work. **Rust** will follow, revisiting types and errors while also examining data ownership.
