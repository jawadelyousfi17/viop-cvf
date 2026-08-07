# Docker — why "works on my machine" stopped being an excuse

You've built something. It runs perfectly on your laptop. You send it to a colleague, and it immediately breaks.

This is the oldest joke in software: "works on my machine." Except it isn't really a joke. It's a real problem with a real cause.

Your application doesn't run on its own. It runs on a specific version of Python, or Node, or Java. It expects certain system libraries. Certain environment variables. A particular operating system. Your colleague's machine has different versions of all of those things. So your code — the exact same code, character for character — behaves differently.

Now scale that problem up. You have a development machine, a testing server, and a production environment, each configured by different people at different times. Multiply that by twenty applications and fifty engineers. This is what people mean by dependency hell, and companies have lost staggering amounts of time to it.

The fix sounds almost too simple. Stop shipping just the code. Ship the code and everything it needs to run — the runtime, the libraries, the configuration — sealed into a single portable package. If the package is identical everywhere, the behavior is identical everywhere.

That package is called a container. And the tool that made containers mainstream is Docker.

To understand why containers were such a big deal, compare them to what came before: virtual machines.

A virtual machine works by simulating an entire computer. You run a hypervisor, and on top of it you install a complete guest operating system — its own kernel, its own drivers, its own everything. It works, and it isolates well. But it's heavy. A single virtual machine can eat gigabytes of disk and take a minute to boot. Running twenty of them on one server is painful.

A container takes a different approach. It doesn't simulate a computer, and it doesn't bring its own kernel. It shares the kernel of the host machine, and uses features built into Linux — namespaces and control groups — to wall off its own slice of the system. The container gets what looks like its own filesystem, its own network interface, its own list of processes. But underneath, it's just processes running on the host.

The result: a container is typically megabytes instead of gigabytes, and starts in under a second instead of a minute. You can comfortably run dozens on hardware that would struggle with a handful of virtual machines.

The tradeoff is that containers share a kernel. The isolation is strong — but not quite as absolute as a virtual machine's.

So where does a container come from? From an image.

An image is a read-only template — a frozen snapshot of a filesystem, plus instructions for what to run. Containers are the live, running instances of that image. One image, many containers. The relationship is like a class and its objects, or a recipe and the meals you cook from it.

You build an image using a Dockerfile: a plain text file, usually a dozen lines or fewer, describing the build step by step. FROM picks a starting point — maybe an official image with Python already installed. COPY brings your source code in. RUN executes commands, like installing dependencies. EXPOSE declares a port. CMD says what should run when the container starts.

Here's the clever part. Each instruction creates a layer, and layers are cached and reusable. Change one line of your source code and rebuild, and Docker only rebuilds from that layer forward. Everything before it is reused instantly.

Finished images get pushed to a registry. Docker Hub is the best-known public one, and most companies run private ones. Push from your laptop, pull onto a server anywhere in the world. Same bytes. Same behavior.

Now let's actually run something.

Type docker run, followed by an image name, and you have a running container. If the image isn't on your machine, Docker pulls it from the registry first. No installer. No configuration. No dependency conflicts with anything else on your system. Need a Postgres database for an afternoon of testing? One command. Delete it afterward and your machine is exactly as it was.

Two things you'll almost always add to that command. First, port mapping — because a container's network is isolated by default. Publishing port eight thousand tells Docker to forward traffic from your machine into the container. Without it, the app is running fine, but nothing can reach it.

Second, volumes. By default, a container's filesystem is ephemeral. Stop and remove the container, and anything written inside it is gone. That's a feature, not a bug — it's what keeps containers reliably reproducible. But databases and uploaded files need to survive. A volume mounts storage from outside the container, so that data outlives it.

Understand those two ideas — ports for traffic in, volumes for anything you want to keep — and you've covered most of what trips people up in their first week.

One container is rarely the whole story. Real applications have parts: a web frontend, a backend API, a database, a cache. Running four separate commands, with the right flags, in the right order, every single time, gets old fast.

That's what Docker Compose solves. You write one YAML file describing every service — how they connect, which ports they publish, which volumes they use. Then a single command, docker compose up, starts all of it on a shared private network where the services can reach each other by name. Your new teammate clones the repository, runs one command, and has the entire stack running locally. That alone has saved countless onboarding days.

Compose is built for a single machine. When you need to run containers across a fleet of servers — restarting them when they crash, scaling them up under load, rolling out updates without downtime — you move to an orchestrator. Kubernetes is the dominant one, and it runs containers built exactly the way we've described.

So: Docker packages an application together with everything it needs into an image, runs it as a lightweight isolated container, and guarantees it behaves the same on every machine. Build once. Run anywhere. That's the whole idea.
