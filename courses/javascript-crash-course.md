# JavaScript in twenty minutes
> The spine of the language in one sitting — values, decisions, loops, functions, arrays, objects, and changing a real page.

<!--
Follows the syllabus of Fabian's "Coding to Go" JavaScript crash course. The
narration is written for this player rather than taken from the video, because
here the board draws alongside the voice and the learner has an editor in front
of them — different medium, different script.

House rules, and one that is specific to this course:
  · Start every sentence with a capital, a digit or a [tag], or the beat
    splitter will not see the boundary and every beat after it shifts.
  · `lines=` counts blank lines too. Count them in the block, not by eye.
  · Changing a word of narration costs a new synthesis. Re-beating is free.
  · EVERY exercise is spoken. If a `task` block asks for something, the
    narration says it out loud first — a learner who is looking at the board
    when the exercise appears should not have to discover it by reading.
-->

## What JavaScript is for

JavaScript is the language that makes a web page do something when you touch it.
Everything you are about to learn is one of the pieces that makes that possible.
[warmly] We are going to move quickly, so do not worry about holding on to all of it the first time.
Type along with me, because it sticks far better that way than reading ever does.

```js write |2 run
console.log('Hello from JavaScript')
```

```point |2 lines=1
your first line of JavaScript
```

```draw |1
title What you are actually doing
flow you write JavaScript > the browser runs it > the page reacts |1
note Everything in this course is one of those three, made more precise. |4
```

## A container with a name on it

A variable is a container for a value, with a name on the front of it.
You make one with the word let, then a name, then an equals sign, then whatever goes inside.
That single line does two jobs — it brings the name into existence, and it puts something in it.
[thoughtful] From then on, writing that name anywhere in your program hands you the value back.
Which means you write a value once, and use it as many times as you like.

```js write |2 run
let favouriteNumber = 16

console.log(favouriteNumber)
```

```point |2 lines=1
the name, and what goes in it
```

```point |4 lines=3
and here it hands the value back
```

```draw |1
title A container with a name on it
box #name favouriteNumber ~accent |1
box #value 16 |3
link name value : holds |4
```

## Naming things

A variable name has to be one unbroken word, with no spaces anywhere in it.
When a name needs two words, you join them up and give the second one a capital letter.
That style is called camelCase, and you will see it absolutely everywhere in JavaScript.
[amused] There are more rules than that, but honestly only one of them really matters.
Name the thing for exactly what it holds, and you will thank yourself in a month.

```js write |1 run
let userAge = 30
let totalPrice = 19.99
let isLoggedIn = true

console.log(userAge, totalPrice, isLoggedIn)
```

```point |2 lines=1-3
two words, joined, second one capitalised
```

```draw |1
title One unbroken word
box #bad user age ~warn |1
box #good userAge ~good |2
note A space ends the name, so JavaScript never sees the second word. |5
```

## Looking inside your own program

Console dot log is how you see what your program is actually doing.
Whatever you put between the brackets gets printed out for you to read.
[pause] You can print a value, the result of a calculation, or a sentence you have built out of both.
It changes nothing about how your program runs — it only lets you watch.

```js write |2 run
let favouriteNumber = 16

console.log(favouriteNumber)
console.log(favouriteNumber + 1)
console.log('My favourite number is ' + favouriteNumber)
```

```point |3 lines=4-5
a calculation, and a sentence
```

```point |4 out
three lines in, three lines out
```

```draw |1
title A window into your program
flow a value > console.log > you can see it |1
```

## Three kinds of value

Every value in JavaScript has a type, and its type decides how it behaves.
A number is written plainly, with no quotes around it at all.
A string is text, and it always wears quotes.
A boolean is either true or false, and there is nothing else it is allowed to be.
[thoughtful] Type is really just the answer to one question — what kind of thing is this?

```js write |2 run
let count = 16
let name = 'Fabian'
let isReady = true

console.log(typeof count, typeof name, typeof isReady)
```

```point |2 lines=1
no quotes, so it is a number
```

```point |3 lines=2
quotes, so it is text
```

```point |4 lines=3
true or false, and nothing else
```

```draw |1
title Three kinds of value
box #n a number ~accent |2
box #s a string ~good |3
box #b a boolean ~warn |4
```

## Why the type matters

Here is the clearest possible reason to care about types.
Five plus five gives you ten, because those are numbers and plus means add.
But five plus five wrapped in quotes gives you fifty-five.
[emphatic] The quotes made them text, and plus on text means join rather than add.
Same symbol, completely different job, decided entirely by the type.

```js write |1 run
console.log(5 + 5)
console.log('5' + '5')
```

```point |2 lines=1
numbers, so it adds
```

```point |3 lines=2
text, so it joins
```

```point |5 out
ten, and fifty-five
```

```draw |1
title One symbol, two jobs
box #num 5 + 5 gives 10 ~good |2
box #str '5' + '5' gives '55' ~warn |3
note The plus did not change. The type of what it was given did. |5
```

## Asking a question

A comparison asks a question about two values, and the answer is always true or false.
Is this bigger than that, is it smaller, is it exactly the same.
For equality you write three equals signs rather than one.
[serious] A single equals sign assigns a value — it does not compare anything at all.
That one confusion is behind an enormous number of beginner bugs.

```js write |1 run
console.log(5 > 3)
console.log(10 === 10)
console.log(10 === '10')
```

```point |3 lines=2
three, to compare
```

```point |5 out
true, true, and false
```

```draw |1
title Every comparison answers true or false
pairs 5 > 3: true, 10 === 10: true, 10 === '10': false |2
note The last one is false because a number is not a string. |4
```

## Combining questions

Often one question is not enough, and that is what logical operators are for.
Two ampersands mean and, so both sides have to be true.
Two upright bars mean or, where one side being true is already enough.
An exclamation mark means not, and it simply flips true into false.
[thoughtful] These feel abstract on their own, and they stop feeling abstract the moment you put one inside an if.

```js write |1 run
console.log(true && false)
console.log(true || false)
console.log(!true)
```

```point |2 lines=1
both sides
```

```point |3 lines=2
either side
```

```point |4 lines=3
the opposite
```

```draw |1
title Three ways to combine
pairs and: both must be true, or: at least one must be true, not: flips it over |2
```

## Making a decision

An if statement is how a program chooses between two paths.
You write if, then a condition in brackets, then a block inside curly braces.
When the condition is true, that block runs.
And else gives the program somewhere to go when it is not.
[emphatic] This is the moment your code stops being a list of instructions and starts reacting.

```js write |2 run
let age = 20

if (age >= 18) {
  console.log('You are an adult')
} else {
  console.log('You are not an adult yet')
}
```

```point |2 lines=3
the condition, in brackets
```

```point |4 lines=5
and the other way out
```

```draw |1
title One condition, two ways out
branch age >= 18 ? You are an adult : Not an adult yet |3
```

## More than two paths

When there are more than two cases, you chain them together with else if.
JavaScript checks each condition in order, starting from the top.
The first one that is true wins, and the rest are never even looked at.
[thoughtful] Which means the order you write them in genuinely changes what your program does.

```js write |1 run
let score = 74

if (score >= 90) {
  console.log('A')
} else if (score >= 70) {
  console.log('B')
} else {
  console.log('C')
}
```

```point |2 lines=3-9
checked from the top
```

```point |3 lines=5
this one wins, so C is never reached
```

```draw |1
title Checked in order, first match wins
flow is it 90 or more? > is it 70 or more? > otherwise |2
note Put the widest condition last, or it will swallow the ones below it. |4
```

## Your turn: a ticket price

[warmly] Time to write something yourself, because this is where it starts to stick.
Here is the task: a ticket normally costs ten, but it is free for anyone under six, and half price for anyone over sixty-five.
Write the if, else if and else that works out the price and stores it.
The starting code is already in your editor, and the age is set to seventy.
Pause here, write it, and press Run — you are looking for the number five.

```js seed
let age = 70
let price = 10

// Work out the price here.

console.log(price)
```

```task |5
A ticket costs 10, is free under 6, and is half price over 65. Set `price` correctly for an age of 70, then Run. You want 5.
expect /\b5\b/
```

```draw |2
title The three cases
flow under 6 is free > over 65 is half > everyone else pays full |2
note Age 70 falls into the middle one. |4
```

## Doing something again

A loop runs the same block of code over and over again.
A while loop keeps going for exactly as long as its condition stays true.
You need three things: somewhere to start, a condition, and something that changes each time round.
[serious] Leave out that last one and the condition never becomes false.
Your program then runs forever, which is a mistake every single programmer has made.

```js write |2 run
let count = 1

while (count <= 5) {
  console.log(count)
  count = count + 1
}
```

```point |3 lines=1
somewhere to start
```

```point |4 lines=5
and the part that eventually ends it
```

```draw |1
title What every loop needs
flow start somewhere > check the condition > run the block > change something |3
note Miss the last one and it never stops. |5
```

## The same loop, written shorter

Counting like that is so common that JavaScript has a tighter way to write it.
A for loop puts all three parts on a single line, separated by semicolons.
Where to start, how long to keep going, and what to do at the end of each pass.
[thoughtful] It does exactly what the while loop did, in a quarter of the room.
The counter is traditionally called i, short for index, and every programmer will know what you meant.

```js write |1 run
for (let i = 1; i <= 5; i++) {
  console.log(i)
}
```

```point |2 lines=1
three parts, two semicolons
```

```point |5 lines=1
i, for index
```

```draw |1
title All three, on one line
flow let i = 1 > i <= 5 > i++ |3
note Start · condition · change. The same three things, gathered up. |4
```

## Bending the pattern

Once the shape is familiar, you can bend it however you like.
Count to a hundred instead by changing the condition.
Or move in steps of five rather than one, by changing the last part.
[warmly] The loop does not care — it simply follows the three things you told it.

```js write |1 run
for (let i = 0; i <= 20; i += 5) {
  console.log(i)
}
```

```point |3 lines=1
five at a time
```

```draw |1
title Steps of five
cells 0, 5, 10, 15, 20 |3
note Change one number and the whole pattern changes with it. |4
```

## Code you can reuse

A function is a block of code with a name, so that you can run it whenever you want.
You write function, then a name, then brackets, then the block in curly braces.
[pause] Now here is the part that trips up almost every beginner.
Writing a function does not run it — writing it only creates it.
To actually run it, you call it, by writing its name followed by brackets.

```js write |1 run
function greet() {
  console.log('Hello')
}

greet()
```

```point |4 lines=1-3
this only creates it
```

```point |5 lines=5
and this is what runs it
```

```draw |1
title Creating is not running
flow write the function > call it by name > now it runs |3
```

## Your turn: a function with an input

A function becomes far more useful when you can hand something to it.
A parameter is a name inside the brackets that stands for whatever you pass in.
Call the function with a different value and you get a different result, from the very same code.
[warmly] So here is your next exercise — write a function called greetUser that takes a name, and logs Hello followed by that name.
Then call it with your own name, press Run, and read your greeting.

```js seed
// Write a function called greetUser here.
// It should take a name and log 'Hello ' + name.


```

```task |5
Write `function greetUser(name)` that logs `'Hello ' + name`, then call it with your own name.
expect /Hello \w+/
```

```draw |1
title One function, many inputs
flow 'Ada' goes in > greetUser(name) > Hello Ada comes out |3
```

## Getting an answer back

So far our functions have printed things, and printing is not the same as producing a value.
Return sends a value back to whoever called the function.
You can then keep it in a variable, use it in a calculation, or pass it somewhere else entirely.
[emphatic] Console dot log shows you something; return hands you something.
That difference is tiny to read and enormous in practice.

```js write |1 run
function addNumbers(a, b) {
  return a + b
}

let total = addNumbers(4, 6)
console.log(total)
```

```point |2 lines=2
sends the answer back
```

```point |3 lines=5
and here it is, caught in a variable
```

```draw |1
title Return hands the value back
flow 4 and 6 go in > addNumbers > 10 comes back out |3
note A function that only logs gives you nothing to work with afterwards. |5
```

## A list of things

An array holds many values inside a single variable.
You write them between square brackets, separated by commas.
Every item has a position, and that position is called its index.
[emphatic] Indexes start at zero, so the very first item sits at index zero.
You reach an item by writing the array's name and the index in square brackets.

```js write |2 run
let technologies = ['HTML', 'CSS', 'JavaScript']

console.log(technologies[0])
console.log(technologies[1])
```

```point |4 lines=3
zero is the first
```

```point |5 lines=3-4
name, then index
```

```draw |1
title Counted from zero
cells 'HTML', 'CSS', 'JavaScript' |3
note The number under each item is its index. |4
```

## Your turn: adding to a list

Push adds an item onto the end of an array.
Pop takes the last one off again.
[warmly] Here is your third exercise, and it puts arrays and functions together.
Write a function called signUp that takes a name and pushes it onto the users array.
Then call it with the name Linus, and log the array — you should end up with four users.

```js seed
let users = ['Ada', 'Grace', 'Alan']

// Write signUp here, then call it with 'Linus'.

console.log(users)
```

```task |5
Write `function signUp(user)` that does `users.push(user)`, then call `signUp('Linus')`.
expect /Linus/
```

```draw |1
title push adds, pop removes
flow three users > signUp('Linus') > four users |4
```

## Describing one thing

An array is good for a list of things; an object is good for one thing with several details.
You write it in curly braces, as pairs of a key and a value.
The key is the name of the detail, and the value is the detail itself.
[thoughtful] You reach a value with a dot, followed by the key's name.
Whenever a set of facts belongs together, an object is usually the right answer.

```js write |2 run
let user = {
  name: 'John',
  age: 20,
  isStudent: true
}

console.log(user.name)
console.log(user.age)
```

```point |4 lines=7-8
a dot, then the key
```

```draw |1
title One thing, several details
pairs name: 'John', age: 20, isStudent: true |3
```

## Walking through a list

Loops and arrays belong together, because a list is exactly the thing you want to act on repeatedly.
Start the index at zero, and keep going while it is less than the array's length.
Length tells you how many items there are, so the loop stretches to fit whatever it is handed.
[thoughtful] Inside the block, you use the index to reach the item you are currently on.
Add another name to the array and the loop copes without you touching it at all.

```js write |1 run
let names = ['Ada', 'Grace', 'Alan']

for (let i = 0; i < names.length; i++) {
  console.log(names[i])
}
```

```point |2 lines=3
zero, up to the length
```

```point |4 lines=4
the item at the current index
```

```draw |1
title The index does the walking
cells 'Ada', 'Grace', 'Alan' |3
note i is 0, then 1, then 2 — and then it stops. |5
```

## A shorter way round a list

Walking an array by index works, but it is a lot of machinery for a simple job.
You set up a counter, write a condition, and increase it yourself, all just to look at each item once.
For each does the whole of that for you.
You call it on the array and hand it a function, and it runs that function once per item.
[warmly] The arrow syntax makes it shorter still, and this is the form you will meet most often in real code.

```js write |1 run
let names = ['Ada', 'Grace', 'Alan']

names.forEach((name) => {
  console.log(name)
})
```

```point |3 lines=3
no counter, no condition
```

```point |5 lines=3
the arrow form
```

```draw |1
title forEach does the walking for you
flow the array > forEach > your function, once per item |3
```

## Changing an actual page

Everything so far has printed to a console, and a console is not a web page.
The document object is how your code reaches the page itself.
You can create an element, put it on the page, and decide what happens when somebody clicks it.
[warmly] The button in the output panel below is real — go on, click it.
Find something, and change it when something happens: that is interactive web development in a sentence.

```js write |1 run
const myButton = document.createElement('button')
myButton.textContent = 'Click me'
document.body.appendChild(myButton)

myButton.onclick = function () {
  myButton.textContent = 'You clicked it!'
}
```

```point |3 lines=1-3
make it, and put it on the page
```

```point |4 out
a real button — click it
```

```draw |1
title Find it, then change it
flow something happens > your function runs > the page changes |3
```

## What you have

[warmly] In about twenty minutes you have covered the spine of the language.
Values and the types they come in, and names to keep them in.
Conditions to decide with, and loops to repeat with.
Functions to package work up and hand it around.
Arrays and objects to hold your data, and a way to reach into the page in front of you.
[thoughtful] Everything else in JavaScript is built out of those — and the way to learn the rest is to go and build something.

```draw |1
title The spine of the language
box #values values and types ~accent |1
box #decide conditions ~good |2
box #repeat loops ~good |3
box #reuse functions ~accent |4
box #data arrays and objects ~accent |5
box #page the page itself ~warn |6
```
