# DNS — how a name becomes an address

Every website you've ever visited has a name. But the internet doesn't actually understand names. It understands numbers.

Type "wikipedia dot org" into your browser and hit enter. In the fraction of a second before the page appears, your computer has to answer one critical question: where, exactly, is that? Not the name — the address. Something like two-oh-eight dot eighty dot one-fifty-four dot two-twenty-four. That's an IP address, and it's the only thing routers and servers on the internet really know how to work with.

Here's the problem. There are billions of devices online, and IP addresses change constantly. Websites move to new servers. Companies switch hosting providers. Nobody is memorizing that. Imagine if your contacts app stored only phone numbers, and you had to remember which twelve-digit string belonged to your mother.

So we built a translation layer — a system that takes the human-friendly names we type and turns them into the machine-friendly numbers the network needs. Automatically. Invisibly. Billions of times per second, all day, every day.

That system is DNS: the Domain Name System. And it's arguably the most important piece of internet infrastructure most people have never heard of.

Before we follow a DNS lookup, you need to be able to read a domain name — because a domain name isn't one flat label. It's a hierarchy. And you read it backwards, from right to left.

Take blog dot example dot co dot uk.

At the far right, invisible but always there, is the root. The silent dot at the end of every domain. That's the top of the tree.

Next comes the top-level domain, or TLD — dot uk, in this case. You know the common ones: dot com, dot org, dot net, country codes like dot jp and dot de, and newer additions like dot dev and dot app.

Then the second-level domain: dot co, marking a commercial entity in the UK.

Then the part someone actually registered and paid for — "example." This is the domain name in the everyday sense.

And finally, at the far left: "blog." A subdomain. Whoever owns example dot co dot uk controls this space and can create as many as they want — blog, shop, mail, api.

All of it together is called a fully qualified domain name. And that hierarchy isn't decoration. It's the exact path DNS walks to find your answer.

So let's actually make a request. You type example dot com. Here's the relay race that follows.

Step one: your computer checks its own memory. Browser cache first, then the operating system's. If it looked this up recently, we're done in microseconds. Let's assume it didn't.

Step two: the query goes to a recursive resolver — usually run by your internet provider, or a public one like Cloudflare's one dot one dot one dot one, or Google's eight dot eight dot eight dot eight. The resolver's job is to do the legwork on your behalf.

Step three: the resolver asks a root server. There are thirteen root server addresses worldwide. The root doesn't know where example dot com lives — but it knows who handles dot com, and it says so.

Step four: the resolver asks the dot com TLD server. That server doesn't have the final answer either, but it knows which nameservers are authoritative for example dot com. It points the way.

Step five: the resolver asks the authoritative nameserver. This is the source of truth — the server the domain's owner actually configured. It replies with the IP address.

The resolver hands that back to your computer, your browser opens a connection, and the page loads. Four questions. Typically under a hundred milliseconds.

That relay race sounds like a lot of work. So here's the honest truth: most of the time, it doesn't happen.

If every device ran a full lookup for every request, the root servers would collapse under the load within seconds. What saves the system is caching — storing answers close to where they're needed.

And caching happens at every layer. Your browser keeps a small cache. Your operating system keeps one. Your router might keep one. And your recursive resolver keeps a very large one, serving thousands or millions of users at once.

So when you visit a popular site, the answer is almost certainly sitting in a cache a few milliseconds away, and the whole journey gets skipped.

But cached data goes stale. What happens when a site moves to a new server? That's what TTL solves — Time To Live. Every DNS record carries a number, in seconds, saying how long it's allowed to be cached. Three hundred seconds means five minutes. Eighty-six thousand four hundred means a full day.

Long TTLs mean speed and less load. Short TTLs mean faster updates when things change. That's the tradeoff — and it's why administrators lower their TTLs before a planned migration, then raise them again afterward.

One last piece. DNS doesn't only store addresses — it stores several kinds of records, each with a job.

An A record maps a name to an IPv4 address. A quad-A record does the same for IPv6. A CNAME is an alias, pointing one name at another. MX records tell the world where to deliver your email. TXT records hold arbitrary text, and get used for things like domain ownership verification and anti-spoofing rules such as SPF and DKIM. NS records declare which nameservers are authoritative. Together, all of a domain's records make up its zone file.

Now, the uncomfortable part. DNS was designed in the early nineteen-eighties, when the network was small and everyone on it was trusted. It was not built with security in mind. Queries traditionally travel unencrypted, and answers can be forged — an attack called cache poisoning, which quietly sends users to a fake site.

The industry's answers: DNSSEC, which cryptographically signs records so forgeries can be detected. And DNS over HTTPS and DNS over TLS, which encrypt the queries themselves, so nobody in between can read or tamper with them.

So: DNS turns names into addresses, through a hierarchy, using resolvers and caches. Invisible when it works — and very obvious when it doesn't.
