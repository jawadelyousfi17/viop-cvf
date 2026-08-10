# JavaScript from the beginning
> Comments, data types, arithmetic and strings — the first hour of JavaScript, taken slowly enough that nothing is skipped.

<!--
Adapted from the freeCodeCamp beginner JavaScript course by Beau Carnes,
covering the material from "Comment Your JavaScript Code" through "Word Blanks".
The setup and installation sections are deliberately left out: this player is
already a working editor, so there is nothing to install before you begin.

Paced deliberately slowly. One idea per section, one sentence per beat, and a
place to stop and try it roughly every third section.

House rules when editing — see also courses/javascript-variables.md:
  · Start every sentence with a capital, a digit or a [tag], or the beat
    splitter will not see the boundary and every beat after it shifts.
  · `lines=` counts blank lines too. Count them in the block, not by eye.
  · Changing a word of narration costs a new synthesis. Re-beating is free.
-->

## Writing something that does not run

Before we write anything that runs, let us write something that does not.
A comment is a line that JavaScript deliberately ignores.
Two forward slashes begin one, and everything after them on that line is skipped.
[thoughtful] Notice that the editor greys it out, which is how you can tell at a glance what will run and what will not.
Comments are notes to yourself, and to whoever reads this after you.

```js write |2 run
// This line does nothing at all
var number = 5

console.log(number)
```

```point |3 lines=1
everything after // is ignored
```

```point |5 lines=4
this line actually runs
```


```draw |1
title Two kinds of line
box #run this one runs ~good |1
box #skip this one is ignored ~muted |4
note Everything after // is a note to a human, not an instruction to the computer. |4
```

## A comment that spans lines

When one line is not enough, there is a second kind of comment.
A slash and a star open it, and a star and a slash close it again.
Everything in between is ignored, however many lines it runs to.
[warmly] Use these to explain why something is done, rather than what it does.
The code already says what it does — only you can say why.

```js write |2 run
/*
  This explains why, across
  as many lines as it needs
*/
var number = 9

console.log(number)
```

```point |3 lines=1-4
opened, and closed again
```


```draw |1
title Opened, and closed again
box #open slash star ~accent |1
box #body anything at all, over any number of lines ~muted |4
box #close star slash ~accent |5
note Say why. The code already says what. |5
```

## The kinds of data

Everything you handle in JavaScript is data, and data comes in types.
There are seven of them, and three will carry almost all of your early work.
A string is text, and it always sits inside quotes.
A number is a number, and JavaScript makes no distinction between whole ones and decimals.
A boolean is either true or false, and nothing else.
[thoughtful] The remaining four — undefined, null, symbol and object — will come to you as you need them.

```js write |2 run
var text = 'this is a string'
var count = 42
var isReady = true

console.log(typeof text, typeof count, typeof isReady)
```

```point |3 lines=1
text, in quotes
```

```point |4 lines=2
a number, no quotes
```

```point |5 lines=3
true or false, nothing else
```


```draw |3
title The three you will use constantly
box #s a string ~accent |3
box #n a number ~good |4
box #b true or false ~warn |5
note Text in quotes · a number · one of exactly two values |5
```

## Giving data a name

A variable is a label that points at a piece of data.
You bring one into existence with the word var, followed by a name.
That act is called declaring it.
[pause] There are two newer words for this, let and const, and those are the ones you will actually reach for.
But var came first, and you will meet it in code older than you expect.

```js write |2 run
var myName = 'Beau'

console.log(myName)
```

```point |3 lines=1
the declaration
```


```draw |1
title var myName = 'Beau'
box #name myName ~accent |1
box #value 'Beau' |4
link name value : points at |4
note `let` and `const` are the modern words for the same act. |5
```

## Declaring and assigning are two different things

Declaring a variable and assigning to it are separate acts, and it helps to see them apart.
This first line declares a, and gives it nothing at all.
The second line declares b and assigns two to it, both in one go.
[emphatic] That equals sign is the assignment operator, and it is not asking a question.
It is not checking whether b is two — it is making b two.

```js write |1 run
var a
var b = 2

console.log(a, b)
```

```point |2 lines=1
declared, and nothing more
```

```point |3 lines=2
declared and assigned at once
```

```task |5
Add a line that assigns 7 to `a`, then run it again.
expect /\b7\b/
```


```draw |2
title Two separate acts
box #declare declare the name |2
box #assign put a value in it ~accent |3
link declare assign : then |3
note `=` does not ask a question. It makes it so. |4
```

## Nothing in it yet

A variable you declare but never assign to is not empty, and it is not zero.
Its value is undefined, which is a real value with a real name.
[thoughtful] It is JavaScript telling you the label exists, but nothing has been hung on it yet.
The moment you assign something, that is what it holds instead.

```js write |1 run
var a
var b
var c

console.log(a, b, c)
```

```point |2 out
three undefineds, printed
```

```task |4
Set `a` to 5, `b` to 10, and `c` to the string `'I am a string'`, then run it.
expect /5 10 I am a string/
```


```draw |3
title Declared, but nothing hung on it
box #label the name exists ~accent |3
box #value undefined ~muted |3
link label value : holds |3
```

## Capitals are part of the name

JavaScript is case sensitive, which means capitalisation is part of a name.
A variable called studlyCapVar and one called StudlyCapVar are two entirely different variables.
[serious] Getting this wrong gives you an error, or worse, a second variable you never meant to make.
The convention that everybody follows is called camelCase.
The first word is lowercase, and every word after it begins with a capital.

```js write |1 run
var studlyCapVar = 10
var properCamelCase = 'all good'
var titleCaseOver = 9000

console.log(studlyCapVar, properCamelCase, titleCaseOver)
```

```point |5 lines=1-3
lowercase first, capitals after
```

```quiz |5
Q You declare `myVar` and then write `myvar = 3`. What happens?
= They are two separate names, so the second one is a different variable
- JavaScript corrects the capitalisation for you
- The second line updates the first variable
> Capitalisation is part of the name, not decoration on it. This is why a typo in a variable name is so often a bug that runs perfectly and does the wrong thing.
```


```draw |3
title One capital apart
box #a studlyCapVar ~good |3
box #b StudlyCapVar ~warn |3
note Two different variables, and no warning that you meant one. |4
```

## Adding and taking away

Arithmetic in JavaScript looks like arithmetic.
Plus adds, and minus subtracts.
[amused] There is genuinely nothing more to this one.
Change the numbers and run it again — nothing here can break.

```js write |1 run
var sum = 10 + 10
var difference = 45 - 33

console.log(sum, difference)
```

```point |2 lines=1-2
add, and subtract
```

```task |4
Change the first line so that `sum` comes out as 100, then run it.
expect /\b100\b/
```


```draw |3
title Exactly what it looks like
box #sum 10 + 10 = 20 ~good |3
box #diff 45 - 33 = 12 ~good |3
```

## Multiplying and dividing

Multiplication uses a star, and not the times sign you would write by hand.
Division uses a forward slash.
[thoughtful] Both of those sit on almost every keyboard in the world, which is exactly why they were chosen.
Everything else about them behaves the way you would expect.

```js write |1 run
var product = 8 * 10
var quotient = 66 / 33

console.log(product, quotient)
```

```point |2 lines=2
the slash divides
```

```point |3 lines=1
and the star multiplies
```


```draw |1
title The two you have to translate
box #star * means times ~accent |1
box #slash / means divided by ~accent |2
note Both sit on every keyboard, which is why they were chosen. |4
```

## Adding one, and taking one away

Adding one to a number is so common that it has a shorthand of its own.
Two plus signs after a variable increase it by one.
Two minus signs decrease it by one.
[pause] You will see these constantly, and especially inside loops.
They do exactly what writing the variable equals itself plus one would do, in three characters instead of fifteen.

```js write |1 run
var up = 87
up++

var down = 11
down--

console.log(up, down)
```

```point |2 lines=2
up by one
```

```point |3 lines=5
and down by one
```


```draw |4
title ++ and --
box #up 87 becomes 88 ~good |4
box #down 11 becomes 10 ~warn |5
note Three characters instead of fifteen. |5
```

## Numbers with a decimal point

JavaScript has no separate type for whole numbers and decimals.
They are all simply numbers, and a decimal one is sometimes called a float.
You write one exactly as you would expect, with a dot.
[thoughtful] Multiplying and dividing them works no differently from whole numbers.

```js write |1 run
var myDecimal = 5.7
var product = 2.0 * 2.5
var quotient = 4.4 / 2.0

console.log(myDecimal, product, quotient)
```

```point |3 lines=1
a dot, and that is all
```

```point |4 lines=2-3
no different from whole numbers
```


```draw |2
title One type, not two
box #whole 42 ~accent |2
box #float 5.7 ~accent |2
note JavaScript sees both of these as simply a number. |2
```

## What is left over

The remainder operator is a percent sign, and it gives you what is left after a division.
Eleven divided by three is three, with two left over, so eleven remainder three is two.
[curious] Its most common use has almost nothing to do with remainders.
If a number divided by two leaves nothing over, then that number is even.
That is how nearly every program you will ever read checks whether a number is even.

```js write |1 run
var remainder = 11 % 3
var evenCheck = 10 % 2
var oddCheck = 7 % 2

console.log(remainder, evenCheck, oddCheck)
```

```point |2 lines=1
two left over
```

```point |4 lines=2-3
zero means even, one means odd
```

```quiz |5
Q How would you check whether a number `n` is even?
= Ask whether `n % 2` is 0
- Ask whether `n / 2` is a whole number
- Ask whether `n % 2` is 1
> `n % 2` is the remainder after dividing by two, and only an even number leaves nothing over. Getting 1 back means the number is odd.
```


```draw |3
title 11 % 3
cells 3, 3, 3, 2 |3
note Three threes, and two left over. The remainder is 2. |4
```

## Adding to what is already there

Adding a number to a variable and storing it back is common enough to have its own shorthand.
Plus equals adds to whatever the variable already holds.
Minus equals takes away from it.
[emphatic] Read `a += b` as "a becomes a plus b", and it will never confuse you again.

```js write |1 run
var a = 3
a += 12

var b = 20
b -= 6

console.log(a, b)
```

```point |2 lines=2
a becomes a plus twelve
```

```point |3 lines=5
and b becomes b minus six
```

```task |4
Add one more line that adds 5 to `a`, so it prints 20. Then run it.
expect /\b20\b/
```


```draw |1
title a += 12
box #before a was 3 ~muted |2
box #after a becomes 15 ~good |3
link before after : add, store back |4
```

## The same trick, times and divide

There is a times equals and a divide equals, and they work in exactly the same way.
Times equals multiplies the variable by a number and stores the answer back in it.
Divide equals does the same with division.
[warmly] Four shorthands, one single idea — do something to the variable, and keep the result in it.

```js write |1 run
var a = 5
a *= 5

var b = 48
b /= 12

console.log(a, b)
```

```point |2 lines=2
twenty five
```

```point |3 lines=5
and four
```


```draw |1
title Four shorthands, one idea
box #plus += |1
box #minus -= |1
box #times *= |2
box #divide /= |3
note Do something to the variable, and keep the answer in it. |4
```

## Text lives in quotes

A string is text, and text lives inside quotes.
You may use double quotes, single quotes, or backticks.
[thoughtful] All three make a perfectly good string, and for now the only rule is that you finish with the same one you started with.
Everything between them is taken literally, spaces and all.

```js write |1 run
var doubles = "I am a string"
var singles = 'So am I'
var ticks = `And so am I`

console.log(doubles, singles, ticks)
```

```point |2 lines=1-3
three wrappers, one kind of thing
```


```draw |3
title Three wrappers, one kind of thing
box #d "double quotes" ~accent |3
box #s 'single quotes' ~accent |3
box #b backticks ~accent |3
note Finish with the same one you started with. |4
```

## A quote inside a quote

Here is the first thing that genuinely trips people up.
If your text contains a double quote, and your string is wrapped in double quotes, JavaScript cannot tell where the string ends.
It reaches the quote inside and assumes you have finished.
[pause] The fix is a backslash, which is called an escape character.
A backslash in front of a quote tells JavaScript that this one belongs to the text, and is not the end of it.

```js write |1 run
var myStr = "I am a \"double quoted\" string"

console.log(myStr)
```

```point |4 lines=1
each backslash rescues the quote after it
```

```point |5 out
and no backslashes come out the other end
```


```draw |3
title Where does the string end?
box #open opening quote ~accent |3
box #inner a quote inside ~warn |3
box #close closing quote ~accent |3
note A backslash tells JavaScript the middle one is text, not the end. |4
```

## The easier way round it

You will not escape quotes very often, because there is a simpler way out.
Wrap the string in single quotes, and double quotes inside need no escaping at all.
The same works the other way round.
[warmly] Backticks are easier still, because both kinds of quote sit inside them quite happily.
Pick whichever wrapper keeps the inside of your string clean.

```js write |1 run
var a = 'I am a "double quoted" string'
var b = "It's fine the other way too"
var c = `Both "kinds" and it's fine`

console.log(a)
console.log(b)
console.log(c)
```

```point |2 lines=1
single outside, double inside
```

```point |3 lines=2
double outside, single inside
```

```point |4 lines=3
backticks take both
```


```draw |1
title Pick the wrapper that keeps the inside clean
box #a 'holds "doubles" fine' ~good |2
box #b "holds 'singles' fine" ~good |3
note And backticks hold both. |4
```

## What else a backslash can do

The backslash does rather more than rescue quotes.
Backslash n starts a new line.
Backslash t inserts a tab.
[thoughtful] And because the backslash has this special job, writing a real one takes two of them.
That last one catches absolutely everybody at least once.

```js write |1 run
var lines = 'FirstLine\nSecondLine'
var tabbed = 'Name:\tBeau'
var slash = 'A real backslash: \\'

console.log(lines)
console.log(tabbed)
console.log(slash)
```

```point |2 lines=1
a new line, mid-string
```

```point |3 lines=2
a tab
```

```point |4 lines=3
two, to get one
```


```draw |1
title What a backslash starts
box #n \n a new line ~accent |2
box #t \t a tab ~accent |3
box #s \\ one real backslash ~warn |4
```

## Joining two strings

You join two strings with a plus sign, exactly as you would add two numbers.
Joining strings is called concatenation.
[emphatic] Watch the spaces.
Nothing is inserted for you, so if you want a gap between two joined strings, one of them has to contain it.
That missing space is the single most common mistake in everything we have covered so far.

```js write |1 run
var withSpace = 'This is the start. ' + 'This is the end.'
var without = 'Squashed' + 'Together'

console.log(withSpace)
console.log(without)
```

```point |4 lines=1
the space lives inside the quotes
```

```point |5 lines=2
and here there is nowhere for one to be
```

```task |5
Fix line 2 so the two words come out with a space between them.
expect /Squashed Together/
```


```draw |3
title Nothing is added for you
box #a 'Squashed' |3
box #b 'Together' |3
link a b : + |3
note If you want a gap, one of the two has to contain it. |4
```

## Growing a string

Plus equals works on strings just as it works on numbers.
It takes what the variable already holds and adds more onto the end of it.
[thoughtful] It is the same shorthand you met with arithmetic, doing the very same job.
Building up a sentence piece by piece is exactly what this is for.

```js write |1 run
var myStr = 'This is the first sentence. '
myStr += 'This is the second sentence.'

console.log(myStr)
```

```point |2 lines=2
added onto the end
```


```draw |3
title myStr += more
box #before what it already holds ~muted |3
box #after and now this on the end ~good |3
link before after : += |4
```

## Putting a variable inside a string

Most of the time the interesting part of a sentence is a value you do not know in advance.
You join the fixed text and the variable together with plus signs, in order.
[pause] And once again, mind the spaces at the joins.
Read the line aloud from left to right, and if it sounds wrong, a space is missing.

```js write |1 run
var myName = 'Beau'

var greeting = 'My name is ' + myName + ' and I am well!'

console.log(greeting)
```

```point |2 lines=3
text, then variable, then text
```

```point |4 lines=3
a space before, and a space after
```


```draw |3
title Fixed, variable, fixed
box #t1 'My name is ' |3
box #v myName ~accent |3
box #t2 ' and I am well!' |3
note Mind the space at each join. |3
```

## Asking how long it is

Every string knows its own length.
You ask for it with dot length, and you get back a number — how many characters it contains.
[thoughtful] Notice that there are no parentheses after the word length.
It is a property of the string rather than something you call.

```js write |1 run
var firstName = 'Ada'
var lastName = 'Lovelace'

var nameLength = lastName.length

console.log(nameLength)
```

```point |2 lines=4
no parentheses
```

```task |4
Change line 4 to measure `firstName` instead. You are looking for 3.
expect /\b3\b/
```


```draw |3
title A property, not a function
box #right lastName.length ~good |3
box #wrong lastName.length() ~warn |3
note No parentheses. It is something the string has, not something it does. |3
```

## Reaching one character

You can pull a single character out of a string using square brackets.
Inside the brackets goes a number, and that number is the position.
[emphatic] Positions begin at zero, and not at one.
So the first character is at zero, the second at one, and the third at two.
This is called zero-based indexing, and it holds in very nearly every programming language.

```js write |1 run
var firstName = 'Ada'

var first = firstName[0]
var second = firstName[1]
var third = firstName[2]

console.log(first, second, third)
```

```point |3 lines=3
zero is the first one
```

```point |4 lines=3-5
zero, one, two
```

```quiz |5
Q In the string `'Ada'`, what does `firstName[1]` give you?
= `d`, because counting starts at zero
- `A`, because it is the first character
- `a`, because it is the last character
> Index 1 is the *second* character. The habit to build is reading `[1]` as "one past the start" rather than as "the first".
```


```draw |2
title 'Ada'
cells A, d, a |2
note The number under each cell is its index, and it starts at zero. |5
```

## The last one, without counting

Often you want the last character but have no idea how long the string is.
You work the position out from the length instead.
[thoughtful] A string of eight characters has its last one at index seven, because the counting began at zero.
So length minus one is always the last index.
Subtract two instead, and you get the second to last.

```js write |1 run
var lastName = 'Lovelace'

var lastLetter = lastName[lastName.length - 1]
var secondToLast = lastName[lastName.length - 2]

console.log(lastLetter, secondToLast)
```

```point |3 lines=3
eight long, so seven is the last
```

```point |5 lines=4
one further back
```


```draw |2
title 'Lovelace' — eight characters
cells L, o, v, e, l, a, c, e |2
note length is 8, so the last index is 7. |4
```

## A string cannot be edited in place

Strings are immutable, which means that once one exists you cannot change part of it.
You may point the variable at an entirely different string, but you cannot reach in and swap a single character.
[serious] Trying it does not even raise an error — it simply does nothing at all, which is far worse.
To change a string, you build a new one and assign that instead.

```js write |1 run
var myStr = 'Jello World'

myStr[0] = 'H'
console.log(myStr)

myStr = 'Hello World'
console.log(myStr)
```

```point |3 lines=3-4
this changes nothing
```

```point |4 lines=6
this is how you do it
```


```draw |2
title You cannot reach in and swap one
box #old 'Jello World' ~muted |2
box #new 'Hello World' ~good |2
link old new : a new string |2
```

## Word blanks

Let us put the whole lot together into something that plays.
A Mad Lib takes a sentence with holes in it and fills them with words of your choosing.
Everything it needs you already have — strings, plus, plus equals, and variables.
[warmly] Read the joins carefully, because every space in the finished sentence has to come from somewhere.
Change the four words at the top and the sentence changes with them.

```js write |1 run
var myNoun = 'dog'
var myAdjective = 'big'
var myVerb = 'ran'
var myAdverb = 'quickly'

var result = ''
result += 'The ' + myAdjective + ' ' + myNoun + ' '
result += myVerb + ' to the store ' + myAdverb + '.'

console.log(result)
```

```point |3 lines=7-8
built one piece at a time
```

```point |4 lines=7
every space, put there on purpose
```

```task |5
Change `myNoun` to `'bike'`, then run it and read your sentence.
expect /bike/
```


```draw |3
title Built one piece at a time
box #adj big |3
box #noun dog |3
box #verb ran |3
note The + joins them, and every space is one you put there. |4
```

## What you have

[warmly] That is a genuine foundation, and it is worth seeing all at once.
You can leave notes in code, and name the seven types of data it works with.
You can declare a variable, assign to it, and tell why undefined is not the same as empty.
You can do arithmetic, take a remainder, and use every one of the four shorthands.
And you can build a string, measure it, and reach into any character of it by index.
[thoughtful] Next comes what happens when a program starts making decisions.


```draw |1
title What you can do now
box #notes leave notes in code ~muted |1
box #types name the types ~accent |2
box #vars declare and assign ~accent |3
box #maths do the arithmetic ~good |4
box #strings build and measure strings ~good |5
note Next: what happens when a program starts making decisions. |6
```
