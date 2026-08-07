--- 7
Step one: your computer checks its own memory. Browser cache first, then the operating system's. If it looked this up recently, we're done in microseconds. Let's assume it didn't. Step two: the query goes to a recursive resolver — usually run by your internet provider, or a public one like Cloudflare's or Google's. The resolver's job is to do the legwork on your behalf.

--- 8
Step three: the resolver asks a root server. There are thirteen root server addresses worldwide. The root doesn't know where example.com lives, but it knows who handles .com, and it says so. Step four: the resolver asks the .com TLD server. That server doesn't have the final answer either. But it knows which nameservers are authoritative for example.com. It points the way.

--- 9
Step five: the resolver asks the authoritative nameserver. This is the source of truth. It replies with the IP address, your browser opens a connection, and the page loads. Four questions, typically under a hundred milliseconds. So here's the honest truth: most of the time, none of this happens at all.
