# JavaScript crash course — verbatim narration
> Your supplied twenty-minute JavaScript lesson, recorded exactly as spoken, with timestamps removed.

<!--
This course deliberately preserves the user's supplied transcript rather than
adapting it for the interactive player. Headings are playback boundaries only;
they are never sent to TTS. Do not edit narration unless the source script is
being corrected, because every edit needs a fresh Fish Audio recording.
-->

## Introduction

JavaScript is the language that makes websites interactive. And in the next 20 minutes, you will learn all the core basics you need to start writing JavaScript yourself. We're going to move fast, so don't worry if you don't understand everything the first time. The best way to learn is to code along while I'll explain the concepts. If you don't know me, my name is Fabian, and you're watching Coding to Go. And if you want to go deeper after this video, you can get my full JavaScript course with the link in the description. But for now, let's start with the basics. If you want to use JavaScript in an HTML file, you can use the script tag. Here you can either write JavaScript directly inside this tag or put it into a separate file and name it something like app.tjs. But for this crash course, I will use runjs. So I can code JavaScript on the left and see the output on the right side. Pretty basic.

```js write |10 run
console.log('Hello from JavaScript')
```

```point |11 out
the result appears here
```

```draw |1
title JavaScript makes pages interactive |1
flow you write code > JavaScript runs it > the page responds |2
note Code on the left · result in the output panel |11
```

## Variables

Let's start with variables. You create a variable using the let keyword. For example, favorite number. To assign a value to a variable, you can use the equal sign. My favorite number is 16. So this is how we declare and initialize a variable at the same time. As you can see, the variable name has to be one consecutive piece. Favorite number has two words. So I simply write the second word with a capital letter. Spaces are not allowed. And there are also a few other rules that you can see here. But the easiest rule to remember is just make your variable names as simple as possible and name them exactly for what they're used for. Okay. Now let's do a console log to see the output. This line of code means print the output of whatever we put inside the parenthesis on the console which is here on the right side of the application. So if I console log the variable favorite number the value 16 will be logged to the console. So you can see a variable is basically just a container for data. You give it a name, you put a value inside and later you can use that value again anywhere in your program. For example, we could say console.log favorite number + 1. Then we'd perform math. Then 17 will be printed onto the console. Or we could also print a text using quotation marks. We can say console log and then in quotation marks my favorite number is and then plus the variable favorite number. Then it is going to show this entire sentence on the console.

```js write |6 run
let favoriteNumber = 16

console.log(favoriteNumber)
console.log(favoriteNumber + 1)
console.log('My favorite number is ' + favoriteNumber)
```

```point |10 lines=1
camelCase keeps the name in one piece
```

```point |16 lines=3
the name gives the stored value back
```

```point |21 out
the calculation prints seventeen
```

```draw |2
title A variable is a named value |2
box #name favoriteNumber ~accent |3
box #value 16 ~good |5
link name value : stores |6
note Declare it once, then use the name anywhere. |18
```

## Data types and arithmetic

Now a value can have different data types. For example, the value 16 is of type number. Text is a string. We have to use quotation marks to create a string. And something like true or false is called a boolean. You don't have to memorize the word data type too hard. It simply means what kind of value is this? And JavaScript needs to know that because it behaves differently depending on the type. Here's an example. If I write 5 + 5 in the console log, you will see the output 10. So, it is performing a mathematical operation. But if I write 5 + 5 like this using quotation marks, I get 55. That is because quotation marks signal that these values are strings and strings are text. One string plus another string will simply create a bigger text. With numbers, we can do addition, subtraction, and all the other stuff you see on the screen.

```js write |2 run
const numberValue = 16
const stringValue = 'Hello'
const booleanValue = true

console.log(typeof numberValue)
console.log(typeof stringValue)
console.log(typeof booleanValue)
console.log(5 + 5)
console.log('5' + '5')
```

```point |5 lines=1-3
number, string, and boolean
```

```point |12 lines=8-9
numbers add; strings join
```

```quiz |15
Q What does `'5' + '5'` produce?
= The string `55`
- The number `10`
- An error
> Quotation marks make both values strings, so plus joins them.
```

```draw |1
title The value decides the behaviour |1
pairs number: 16, string: 'Hello', boolean: true |5
note `+` adds numbers and joins strings. |14
```

## Operators and the first if statement

Now, let's talk about operators. Operators are symbols that let us do something with values. You have already seen the mathematical operators, but they're also comparison operators. For example, is 5 greater than 3 or is 10 equal to 10? These comparisons always give us either true or false. So, the result is a boolean. And that leads us directly to logical operators. These are used when you want to combine multiple conditions. For example, and both things must be true. Or this operator here means or. At least one thing must be true. And the exclamation mark means not. It flips true to false and false to true. Don't worry if that sounds abstract for now. This is the kind of thing you understand once you use it inside actual conditions. So let's do exactly that with an if statement. An if statement lets your program make a decision. For example, if someone is older than 18, you console log you are an adult. And if that condition is not true, we can use else to do something different. So basically, if this is true, do this. Otherwise, do something else. That is one of the most important ideas in programming because now your code is no longer just running line by line. Now it can react differently depending on the situation.

```js write |4 run
const age = 20
const hasTicket = true

console.log(5 > 3)
console.log(10 === 10)
console.log(age >= 18 && hasTicket)

if (age >= 18) {
  console.log('You are an adult')
} else {
  console.log('You are not an adult yet')
}
```

```point |6 lines=4-6
every comparison produces true or false
```

```point |18 lines=8-12
one condition, two possible paths
```

```draw |16
title An if statement chooses a path |16
branch age >= 18 ? You are an adult : Not an adult yet |18
note The condition decides which block runs. |23
```

## If, else, and else if

So let's review the syntax of an if statement so you really understand it. It starts with the if keyword and a pair of parenthesis. Now in here you have to write a condition meaning an expression that is either true or false. These expressions can be all sorts of things. Here we're doing a comparison. Is the value that is stored in h bigger than 18? That is a comparison. We can also ask if it is exactly 18 with three equal signs. Now the condition will be false. Depending on this condition, one of two things will happen. If true, the first code block will run. A code block is encapsulated by these curly braces. The else initiates the code block that should run if the condition is false. Again, we use curly braces to say from where to where the false code block should go. But what I didn't tell you is that there's also an else block. But what does that do? You can use else if to check multiple possible cases. So first I ask if this is the case and if it's not the case, it will not perform the code block and check the next else if. If this is also false, it will go into the next else if and so on. Eventually, if one of the conditions is true, it will perform that code block. And if none of the conditions are true, it will perform the else code block.

```js write |2 run
const age = 18

if (age > 18) {
  console.log('Older than eighteen')
} else if (age === 18) {
  console.log('Exactly eighteen')
} else {
  console.log('Younger than eighteen')
}
```

```point |3 lines=3
the first condition
```

```point |8 lines=5
three equal signs compare value and type
```

```point |17 lines=5-9
else if adds another possible case
```

```quiz |21
Q In an if / else-if / else chain, how many branches run?
= Only the first branch whose condition is true
- Every branch whose condition is true
- The else branch always runs last
> JavaScript stops checking after the first matching branch.
```

```draw |10
title Conditions are checked from top to bottom |10
flow age > 18 > age === 18 > otherwise |17
note The first true condition wins. |20
```

## Logical operators in conditions

Now, as I said before, when working with if statements, we often use logical operators. So, let's understand that again because these allow you to combine multiple conditions together. The three main logical operators are and, or not. The and operator means that both conditions must be true. So for example, if a user has to be over 18 and has a ticket, both of those checks must pass before the code inside the if statement runs. So this code block will only happen if both are true. If one of them is false, the code will not run. The or operator means that at least one condition must be true. So if a user is an admin or a moderator, that would already be enough. So it does not matter if one of these is false. If the other one is true, that is enough to execute the code block. And then there's not. You write this one before the value and it flips the meaning. So true becomes false and false becomes true. That is useful when you want to check if something is not the case. For example, if a user is not logged in, then show the login message. So logical operators help you build more realistic conditions because in real projects, decisions are often based on more than just one simple check. If you are a total beginner, this is usually the point where you should start solving some exercises yourself and apply the things you've learned about if statements. for example, calculating the logic for a ticket price based on different conditions. And that is exactly the kind of practice we do inside our full JavaScript course on Udemy. So, if you want to learn JavaScript more actively with videos like this and coding exercises in between, click the first link in the description to get a special discount on the course.

```js seed
const age = 20
const hasTicket = true
const isAdmin = false
const isModerator = true
const isLoggedIn = false

console.log(age >= 18 && hasTicket)
console.log(isAdmin || isModerator)
console.log(!isLoggedIn)
```

```point |5 lines=7
and requires both sides
```

```point |9 lines=8
or requires at least one side
```

```point |16 lines=9
not flips the value
```

```task |18
Change `hasTicket` to `false`, add an if statement that logs `No entry` when the age-and-ticket check fails, then Run.
expect /No entry/
```

```draw |3
title Three logical operators |3
pairs &&: both must be true, ||: either may be true, !: flip the value |14
note Combine small checks into realistic decisions. |17
```

## While loops

Now, let's talk about loops. Loops are probably one of the first things in JavaScript that feel a bit weird as a beginner because up until now, our code runs from top to bottom, line by line. But a loop lets us run the same code block multiple times which is useful when you want to repeat something again and again. For example, let's say we want to count from 1 to 10. Now technically you would need to write 10 console locks but obviously that would be very repetitive. So instead we use a loop. First I create a variable called count and I set it equal to one. So right now count starts at one. Then I write while and inside parenthesis I put a condition. For example, while count is less than 10, I want to repeat this code block which is encapsulated with curly braces. So, whatever code I place in here will be happening while that condition is true. All right. So, what is the action we want to repeat? I want to repeat console.log and I will console log the variable count. Now, here's the important part. If I stop here, this would be a problem because count is still one. So, the condition is still true and this will cause an infinite loop. So inside the loop we need to change something. In this case we increase the counter variable. So after logging it to the console I write count equals count + 1. It means take the current value of count and increase it by one. So now the first time it logs one then it becomes two. So it logs two. Then count becomes three. And every time it is checking the condition is the count variable still less than 10. And as long as that is the case it can keep going and just increase the counter and log it to the console. But the moment the count variable becomes 11, this condition is no longer true. So the loop stops and it won't perform the code block anymore. So a while block is basically saying keep repeating this code while this condition is true. And by the way, we could also count to 100 or even 1,000 while still using the same code. So hopefully you can see how useful a loop can be when we want to repeat something very often.

```js write |7 run
let count = 1

while (count <= 10) {
  console.log(count)
  count = count + 1
}
```

```point |10 lines=3
repeat while this condition is true
```

```point |14 lines=4
the action that repeats
```

```point |20 lines=5
the change that eventually ends the loop
```

```task |30
Change the loop so it counts from 1 through 5, then Run. The final printed number should be 5.
expect /1\s+2\s+3\s+4\s+5\s*$/
```

```draw |3
title A loop repeats a block |3
flow start at one > check the condition > print count > increase count |21
note If nothing changes, the loop never ends. |17
```

## For loops

But very often in JavaScript, we use a for loop instead when we're counting because the while loop needs three lines of code only to set up the loop. We need the starting value, the condition, and the logic that will eventually end the loop. The actual thing we are performing, which is the console log, is only one line of code here. So to make it a bit cleaner, we can use the for loop instead. Here the syntax is first where does the loop start? We start with let count equals 1. Then you write a semicolon because next comes the condition. For how long should we perform the for loop as long as count is less than or equal to 10. Now another semicolon. Lastly, the third thing you do is to increase the count. Count plus. This is the same as saying count equals count + 1 just shorter. So now we have put all three things that it takes to set up a loop into one line of code. And the semicolons simply separate the three things. Now inside the code block we can write our console log count. So it is exactly the same thing as the Y loop just shorter. And because we do this thing quite a lot, it has become a standard to use the letter I for the count variable. I stands for index and is the most common variable name in a for loop. So if we change that, it is even shorter and everyone knows what you mean.

```js write |4 run
for (let i = 1; i <= 10; i++) {
  console.log(i)
}
```

```point |6 lines=1
start; condition; change
```

```point |15 lines=2
the action that repeats
```

```draw |2
title A for loop gathers the setup |2
flow let i = 1 > i <= 10 > i++ |13
note The semicolons separate the three parts. |14
```

## Changing a loop

Now that you know how to repeat an action, you should know that we can do a lot of things inside a loop other than just a console log. Just remember that everything you write in the code block will happen over and over again until the condition is false. You can change the condition and make it count to 100 if you want or even increase the index variable by five instead of just one. Now it counts up to 100 in steps of five. All of that is up to you.

```js write |3 run
for (let i = 0; i <= 100; i += 5) {
  console.log(i)
}
```

```point |4 lines=1
stop at one hundred, moving five at a time
```

```task |5
Change the step from 5 to 10, then Run. The output should begin 0, 10, 20.
expect /0\s+10\s+20/
```

```draw |3
title Change the setup, change the pattern |3
cells 0, 5, 10, 15, 20 |4
note The same loop can count by any step. |5
```

## Functions

Now let's talk about functions. A function is basically a reusable block of code. Instead of writing the same code again and again, you put it into a function and run that function whenever you need it. For example, I can create a function called greet and inside that function I log hello. Then nothing will happen yet. And that is important. Creating a function does not run the function. It only defines it. To actually use it, you have to call the function by writing its name with parenthesis. Now the code inside runs. So functions help you organize your code and reuse logic and avoid repeating yourself. But functions will become way more useful when they have parameters. A parameter is just an input for the function. So instead of always logging the exact same message, we can make the function more flexible. For example, I can create a function called greet user and give it a parameter called username. Then inside the function, I can say hello plus username. Now when I call the function, I can pass in any name I want and on the console log, it will say hello plus that name. I can call the function multiple times, pass in a different name every time, and it will always greet a different user. So even though I'm executing the same code, I'm just changing the input. And that is a great use case of parameters.

```js write |4 run
function greet() {
  console.log('Hello')
}

greet()

function greetUser(username) {
  console.log('Hello ' + username)
}

greetUser('Ada')
greetUser('Linus')
```

```point |7 lines=1-3
defining the function does not run it
```

```point |9 lines=5
parentheses call the function
```

```point |15 lines=7
username is the parameter
```

```quiz |20
Q What is a function parameter?
= A name for an input supplied when the function is called
- The value a function always prints
- A second name for the function
> A parameter lets the same function work with different input values.
```

```draw |2
title A function packages reusable work |2
flow input > function body > result |13
note Define it once; call it whenever you need it. |11
```

## Return values

But sometimes you don't just want a function to do something. Often times you want it to give you a value back. That means the function is doing something and it will give you back a value that you can use in your program. And that is where return values come in. For example, let's create a function called add numbers. It takes two parameters like number one and number two and instead of logging the answer directly, we return the result. So return num one plus num two. That means the function sends the final value back to wherever it was called. And then we can store that returned value inside a variable or log it or use it somewhere else in your program. And this is a super important difference. Console log just shows something on the console. Return gives you a value back so your program can keep working with it. Now this function only added two numbers together. But in real life applications these functions can get a lot bigger, perform multiple operations, calculate some complicated stuff and then return the result at the end. So you will be using functions very often in JavaScript.

```js write |5 run
function addNumbers(numberOne, numberTwo) {
  return numberOne + numberTwo
}

const result = addNumbers(4, 6)
console.log(result)
```

```point |7 lines=2
return sends the value back
```

```point |9 lines=5
the returned value is stored here
```

```draw |4
title Return gives the caller a value |4
flow 4 and 6 > addNumbers > 10 |8
note console.log shows it · return hands it back |12
```

## Arrays

Now let's move to arrays. An array is used to store multiple values in one place. For example, if I want to store several numbers or several names, I can put them all into an array. Arrays use square brackets and the values are separated by commas. Each item inside the array has a position. We call this index. In programming, array positions start at zero. So the first item is at index zero, the second at one, the third at two, and so on. It can feel weird at the beginning, but you will get used to it very quickly. Now, if I want to access the first value of this array, I have to use this syntax. I have to write the name of the array, then a pair of square brackets, and then the index of the item I want to access. Technologies at index zero. This will give me the value HTML. technologies at index one will give me CSS. Arrays are extremely common because in real projects you're constantly working with a list of things. For example, a list of products, users, or comments. Now, if you want to add another item to the end of an array, you can use the push method. So, if I write technologies push react, then react gets added to the end of the array. And sometimes you want to remove an item again. Here you would use the pop method. So, you write technologies.pop pop to remove the last item from the array. That means if React was the last item, it is now gone again.

```js write |3 run
const technologies = ['HTML', 'CSS', 'JavaScript']

console.log(technologies[0])
console.log(technologies[1])

technologies.push('React')
console.log(technologies)

technologies.pop()
console.log(technologies)
```

```point |8 lines=1
the first item is at index zero
```

```point |13 lines=3-4
square brackets access an item by index
```

```point |17 lines=6
push adds to the end
```

```point |20 lines=9
pop removes the last item
```

```quiz |21
Q Which index contains the first array item?
= Index 0
- Index 1
- Index -1
> JavaScript arrays are zero-indexed.
```

```draw |2
title An array is an indexed list |2
cells 'HTML', 'CSS', 'JavaScript' |8
note push adds at the end · pop removes from the end |20
```

## Array exercise

Now, let's turn what you've learned about arrays and functions into a small exercise so you really understand how these concepts work together. This is your starting code. You have an array of users. Each user is a string that contains his name. Your task is to think of a function with the name signup that adds a user to this array. So when I call sign up and pass in a name which is just a string then this string should be added to the users array. That means if I console log at the end I will have five users instead of four. Pause the video and think about the solution. I will show you the solution right now. First you create the function sign up. For this function we're going to need a parameter which I call user. In the function I access the users array and call the push method where I use that parameter. The user will be pushed into the users array. So if I call the sign up function and pass in a name, it will be added to the array. I can sign up many different users using the same signup function. Pretty simple.

```js seed
const users = ['Ada', 'Grace', 'Alan', 'Linus']

// Write the signUp function here.

console.log(users)
```

```point |3 lines=1
the starting array
```

```task |8
Write `function signUp(user)` so it pushes the user into `users`. Call `signUp('Eve')`, then Run. The output should contain Eve.
expect /Eve/
```

```draw |1
title Combine a function with an array |1
flow a name goes in > signUp runs > push adds the name |13
note Four users become five. |7
```

## Objects

Now let's talk about objects. Objects also store data, but in a different way. An object is great for describing one thing with multiple details. For example, one user. This user could have a name, an age, and a country. So instead of just putting names into an array, we could put entire objects with a lot of information about each user into the array. But let's start simple. Objects use curly braces and the data is stored in key value pairs. So for example, name John, age 20, and is student is true. Each property holds a value which can be of any data type. And after each key value pair, you write a comma to separate them. Now that makes the data much easier to understand. And to access something from an object, you can use dot notation. So user dot name gives you John. And objects are everywhere in JavaScript. Whenever you want to group related information together, objects are usually the answer.

```js write |8 run
const user = {
  name: 'John',
  age: 20,
  country: 'Morocco',
  isStudent: true
}

console.log(user.name)
console.log(user.age)
```

```point |9 lines=1-6
related properties grouped in one object
```

```point |14 lines=8-9
dot notation reaches a property
```

```quiz |16
Q What is an object best suited to describe?
= One thing with several named details
- Only a list of numbers
- A block of code that repeats
> Object properties keep related facts together under meaningful keys.
```

```draw |3
title One user, several details |3
pairs name: 'John', age: 20, country: 'Morocco', isStudent: true |9
note Dot notation reads one property. |14
```

## Loops with arrays

Now that you know how arrays and objects work, it's time to revisit the topic of loops. Because so far I only showed you loops as a way to count upwards, for example, from 0 to 100. And sure, that is useful for understanding how loops work. But I would say that most of the times we use loops to work with arrays because think about it, a loop helps us to repeat the same action over and over again. So, if you have a list of items in an array and you want to perform an action over and over for every item, a loop would come in handy. Here's an example. We have an array of names and to console log all the names, I use a for loop. We have the index i that starts at zero and we want to keep running as long as it is smaller than the length of the array. After every loop, we increase index by one. Now, inside the loop, we do a console log. I want to console log all the names. So, I access the names array at index i. You see the variable I is always changing. It starts at zero and counts up until array.length. So basically until it reaches the last item of the array. That way when the loop starts and I is zero, we access names at index zero. So the first name is printed. Then I will be increased by one. So we console log names at index 1, which is the second name. And this will keep happening until we reach names.length. But iterating over an array is a pretty common thing. And it already feels a bit too complicated to use this entire for loop setup for this. We need a counter variable. We need a condition and we need to manually increase the counter. And we access each item using square brackets. That is why JavaScript gives us a much cleaner option for arrays. And that is the for each method.

```js write |7 run
const names = ['Ada', 'Grace', 'Alan']

for (let i = 0; i < names.length; i++) {
  console.log(names[i])
}
```

```point |8 lines=3
start at zero and stop at the array length
```

```point |12 lines=4
the changing index selects each item
```

```point |19 out
one name is printed on each pass
```

```draw |5
title The index walks across the array |5
cells 'Ada', 'Grace', 'Alan' |7
flow i = 0 > i = 1 > i = 2 > stop |20
note The same loop fits any array length. |20
```

## For each and arrow functions

The for each method is used directly on an array. And what it does is simple. It iterates over the array for you one item at a time just like the for loop with the index variable. But what makes this one simpler is that it uses a function. So inside the parenthesis of for each you pass in the name of a function as a parameter. For example, print name and the for each method will call this function for every item. So we first have to define this function ourselves. Function print name. It has a parameter name which represents the current item of the for each loop. And this item simply gets console logged. Now I know this might look a bit confusing at first. So let me simplify it for you. You might be wondering why don't we have parenthesis here when we pass the function. That is because we don't want to call the function here. Here we just pass the function name as an argument. The for each method is going to call this function and it's going to pass the current item of each iteration as the parameter of that function. That is where the parameter name comes from. It's all happening behind the scenes within the for each loop. But we can specify what should happen for each item inside this function. We can console log it, maybe add a few other things to it, and all of this code will be executed for each item of the array. That's why it's called for each method. And because we do this thing quite often, I want to show you an even shorter syntax. We don't have to put our code into a separate named function. We can also pass in a nameless arrow function just like that. Here we have our parameter name and we perform the console log inside. That is just a different syntax for the same thing.

```js write |6 run
const names = ['Ada', 'Grace', 'Alan']

function printName(name) {
  console.log(name)
}

names.forEach(printName)

names.forEach((name) => {
  console.log(name)
})
```

```point |10 lines=3-5
the callback receives the current item
```

```point |15 lines=7
pass the function without calling it
```

```point |24 lines=9-11
the arrow function is the shorter form
```

```draw |3
title forEach visits every item |3
flow array > current item > callback function |16
note No counter or manual index is required. |21
```

## DOM manipulation

Let's quickly talk about DOM manipulation. What you see here is a very basic HTML file because often we want to use JavaScript to make something happen on a website, not just on a console. For example, we want to run some code when the user clicks a button. But how would we do that? We need a button in HTML and a script tag at the bottom of the body. To make something happen on click, we need the onclick attribute in HTML. Here I call a function. For example, say hello. Now inside our script tag, we can write the JavaScript code that you already know. So let's define that function say hello. Here I perform an alert that says hello. Alert is a built-in function. So now in the browser where I'm testing this website, I can click on the button and a browser message appears that says hello. But we can also use JavaScript to change the elements we have on the website. For example, let's change the text on the button. For that, I need my button in a variable. So I create a variable my button and use document.getelement by ID and pass the ID of my HTML button as an argument. Now this HTML button can be accessed with this variable because I'm basically searching the entire document for an element that has this exact ID. That means the ID attribute has to match exactly with this argument. Now inside the function I can say my button.ext content equals hello and that should change the text inside the button when it is clicked. Pretty cool, right? Now, while this is a very basic example, it should show you that JavaScript can change the website content based on user interactions, which makes it very powerful in modern web development.

```js write |5 run
document.body.innerHTML = '<button id="myButton">Click me</button>'

const myButton = document.getElementById('myButton')

function sayHello() {
  alert('Hello')
  myButton.textContent = 'Hello'
}

myButton.onclick = sayHello
```

```point |8 lines=5-8
the function that handles the click
```

```point |17 lines=3
find the element by its exact id
```

```point |20 lines=7
change the button text
```

```point |21 out
click the rendered button
```

```draw |3
title Interaction is an event followed by a change |3
flow the button is clicked > sayHello runs > the page changes |20
note Find an element, listen for an event, update the element. |22
```

## Conclusion

Now, I will admit this course was very fast because I did not want to waste your time. But if you want to take your time and really get good at this, I recommend you get my full JavaScript course. There you will learn everything we talked about in this video in more detail and with practical exercises. We'll also dive into many more advanced concepts that we haven't talked about in this video, especially how to use JavaScript to build interactive websites. Think about how much we covered in this 20-minute video and how much more you could learn in 8 hours. So, click the link in the description and I'm happy to see you in your first lesson of the JavaScript course. My name is Fabian and this was coding to go.

```draw |1
title The JavaScript foundations |1
box #values values and variables ~accent |1
box #decisions conditions ~good |2
box #loops loops ~good |3
box #functions functions ~accent |4
box #data arrays and objects ~accent |5
box #dom interactive pages ~warn |6
note Build small projects and use every idea again. |7
```
