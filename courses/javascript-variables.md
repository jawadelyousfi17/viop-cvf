# JavaScript variables
> Ten short sections on the one idea everything else sits on: giving a value a name, and knowing what that name can and cannot do.

<!--
Prose is narration: one sentence, one beat. Fenced blocks are direction, each
pinned to a beat number. See lib/course.ts for the format, and run
`node scripts/course-voice.mjs javascript-variables` once to record it.

Three house rules when editing:
  · Start every sentence with a capital, a digit or a [tag]. The beat splitter
    needs one to see a boundary, so a sentence opening with a bare `const`
    silently joins the sentence before it — and every beat after it shifts.
  · Delivery tags in [brackets] are performed, never spoken, never captioned.
  · Changing a word of narration is a new recording. Re-beating a block is free;
    rewriting a sentence costs a synthesis. Edit prose deliberately.

Whenever the narration says "notice", "here", or "this line", it needs a
`point` — the learner cannot follow a finger you did not raise.
-->

## A name for a value

A variable is a name you give to a value so that you can reach it again later.
[thoughtful] Most people are taught it is a box that holds something, and that picture quietly causes trouble later on.
It is much closer to a label you stick onto a value.
The value itself lives in memory, and the name is only how you get hold of it.

```js write |2 run
let colour = 'teal'

console.log(colour)
```

```point |3 lines=1
the label, and the value it is stuck to
```

```point |4 lines=3
reaching the value back by its name
```


```draw |1
title A label, not a box
box #name colour ~accent |1
box #value 'teal' |2
link name value : points at |2
```

## Making one with let

You create a variable with the word let, then a name, then an equals sign, then the value.
That whole line is called a declaration, because it is where the name comes into existence.
[pause] The equals sign there does not mean equality.
It means take the thing on the right and put it into the name on the left.
Read it as gets rather than equals, and a surprising amount of confusion goes away.

```js write |1 run
let price = 10

console.log(price)
```

```point |2 lines=1
the declaration
```

```point |4 lines=1
right goes into left
```


```draw |3
title let price = 10
box #right 10 |3
box #left price ~accent |3
link right left : gets |5
note The right-hand side goes into the left-hand name |5
```

## Pointing a name somewhere else

Once a name exists you can point it at a different value whenever you like.
Notice that there is no let on the second line here.
[emphatic] Writing let a second time is redeclaring the variable rather than reassigning it, and JavaScript will refuse.
The word let is for bringing a name into existence, and a bare equals sign is for changing where it points.

```js write |1 run
let score = 10
score = 25

console.log(score)
```

```point |2 lines=2
no `let` — this is a reassignment
```

```point |4 lines=1
`let` makes the name
```

```task |4
Add a line that changes `score` to 99, then log it again and press Run.
expect /\b99\b/
```


```draw |3
title One name, two values over time
box #old 10 ~muted |3
box #score score ~accent |3
box #new 25 ~good |3
link score new : now here |3
note `let` makes the name. A bare `=` moves it. |4
```

## const, for a name that never moves

If a name is never going to point at anything else, write const instead of let.
That is not a polite suggestion — reassigning a const is an error, and you will see it the moment you run the code.
[warmly] Most working programmers reach for const first, and use let only when they know a value genuinely has to change.
It makes code easier to read, because const is a promise that nothing here moves.

```js write |2 run
const country = 'Morocco'

console.log(country)
```

```point |3 lines=1
const first, let only when you must
```

```quiz |4
Q What exactly does `const` prevent?
= Pointing that name at a different value
- Changing anything stored inside the value
- Reading the value more than once
> It freezes the *binding* — the link between the name and the value. What the value itself does afterwards is not `const`'s business, which is the subject of the next section.
```


```draw |1
title const nails the name down
box #const country ~good |1
box #val 'Morocco' |1
link const val : never moves |1
```

## The const trap

[curious] Here is the part that catches very nearly everyone.
The const keyword freezes the name, and not the value that the name points at.
So a const array can still have things pushed into it quite happily.
The name is still pointing at the same array — it is the array itself that changed.
If you want the contents locked down as well, that is a different tool called Object dot freeze.

```js write |2 run
const list = ['a', 'b']
list.push('c')

console.log(list)
```

```point |3 lines=2
pushing into it is allowed
```

```point |4 lines=1
this name never moved
```


```draw |1
title const freezes the arrow, not the box
box #name list ~good |1
box #arr the array itself ~accent |1
link name arr : frozen |1
cells 'a', 'b', 'c' |5
note The arrow cannot move. What it points at still can. |5
```

## var, and why you will still meet it

Before 2015 there was only var, and you will run into it in older code.
A var is scoped to the entire function it sits in, which means one declared inside an if block leaks out of that block.
[serious] That leaking caused real, expensive bugs for years.
Both let and const are scoped to the nearest pair of curly braces instead, which is what almost everybody expects.
So the rule is simple: const first, let when you must, and var never in new code.

```js write |1 run
function demo() {
  if (true) {
    var leaks = 'I escaped the if block'
  }
  console.log(leaks)
}

demo()
```

```point |2 lines=3
declared in here…
```

```point |3 lines=5
…and still readable out here
```

```task |5
Declare `const shout = 'inside'` within a block, log it from **inside** those braces, and run it.
expect /inside/
```


```draw |4
title Where a name can be seen
box #fn the whole function ~muted |4
box #block just these braces ~accent |4
note `var` escapes to the function. `let` and `const` stay in the braces. |4
```

## Braces make a scope

A pair of curly braces creates a brand new scope.
Anything declared with let or const inside them simply does not exist outside them.
[pause] This is why two different blocks can each use the same short name without ever colliding.
Code on the inside can see variables from the outside, but the outside can never see in.

```js write |1 run
const message = 'outer'

{
  const message = 'inner'
  console.log(message)
}

console.log(message)
```

```point |2 lines=3-6
a new scope, and its own `message`
```

```point |3 lines=8
out here, the outer one is untouched
```

```quiz |4
Q Why does the code above print `inner` and then `outer`?
= The inner `const` exists only between its braces
- The second `console.log` reassigned the value back
- JavaScript prints declarations in reverse order
> They are two entirely separate variables that happen to share a name. The inner one is created on entry to the block and gone on exit, which is exactly what block scope means.
```


```draw |1
title Two names, two scopes
box #outer message = 'outer' |1
box #inner message = 'inner' ~accent |2
note The same word, but two separate variables. The inner one ends at the closing brace. |3
```

## What you are allowed to call things

A name may contain letters, digits, dollar signs and underscores, but it cannot begin with a digit.
It also cannot be one of the language's own keywords, so nothing you own may be called class, return or const.
[amused] The convention everybody follows is camelCase — the first word lowercase, and every word after it capitalised.
Names are case sensitive too, so totalPrice and TotalPrice are two completely different variables, which is a fine way to lose an afternoon.

```js write |1 run
const totalPrice = 42
const _internal = true
const $element = 'jquery says hello'

console.log(totalPrice, _internal, $element)
```

```point |2 lines=1-3
letters, `_` and `$` — never a leading digit
```

```point |3 lines=1
camelCase, and case sensitive
```


```draw |3
title camelCase, and case sensitive
box #a totalPrice ~good |3
box #b TotalPrice ~warn |4
note One capital apart, and completely unrelated. |4
```

## Empty on purpose, and empty by accident

A variable that has been declared but never given a value is undefined.
That is the language saying the name exists, but nothing has been put into it yet.
The value null is a different thing entirely — it means somebody deliberately put nothing there.
[thoughtful] Undefined is usually an accident, whereas null is usually a decision.
And a name that was never declared at all is a third case again, which throws a ReferenceError.

```js write |1 run
let nothingYet
const deliberatelyEmpty = null

console.log(nothingYet, deliberatelyEmpty)
```

```point |2 lines=1
no value ever given
```

```point |3 lines=2
chosen, not missed
```

```point |4 out
one accident, one decision
```

```task |5
Declare a variable with `let` but give it no value, then log it. You are looking for `undefined`.
expect /undefined/
```


```draw |1
title Three kinds of nothing
box #u undefined ~muted |1
box #n null ~accent |3
box #r ReferenceError ~warn |5
note Declared but unset · deliberately empty · never declared at all |5
```

## What you now know

[warmly] So a variable is a name for a value, and not a box that contains one.
Use const for the names that never move, let for the few that do, and var for none of them.
Every name belongs to the braces it was declared inside.
And undefined means nobody filled it in, while null means somebody chose to leave it empty.
[thoughtful] That is variables — the next thing worth learning is what kinds of value you can put in them.

```quiz |4
Q Which should you reach for first when writing a new variable?
= `const`, dropping to `let` only when the value must change
- `let`, because it is more flexible
- `var`, because it works everywhere
> Starting with `const` means every `let` in your code is a signal that something changes there. If everything is `let`, that signal is worth nothing.
```


```draw |1
title Variables, in one picture
box #name a name ~accent |1
box #value a value |2
link name value : points at |2
note const never moves · let may move · var: avoid |3
note Every name belongs to the braces it was declared in |5
```