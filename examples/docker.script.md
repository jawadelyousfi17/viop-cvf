--- 1
Start with the older answer, the one containers replaced: a virtual machine. At the bottom sits a hypervisor, carving one real machine into several pretend ones. On top of that goes an entire guest operating system, with its own kernel and its own drivers. What that buys you is genuinely good isolation. What it costs you is gigabytes of disk and about a minute of booting, every single time. Run ten of them and you have started ten operating systems in order to run ten programs.

--- 2
So what does a container do instead? Underneath, it is one ordinary process on the host, running on the host's own kernel. What makes it a container is what the kernel hides from it. It gets its own view of the filesystem, its own network interfaces, and its own process table. Nothing is emulated and nothing is virtualised. The kernel is simply lying to it, consistently, about what else exists.

--- 3
A container comes from an image, and the image comes from a Dockerfile. The Dockerfile is a recipe: a base to start from, and a list of steps. Building it produces the image, which is read-only and frozen. Pushing it puts the image in a registry, where anyone can pull it. Running it makes a container. The same image on your laptop and in production is the same bytes, which is the entire promise.

--- 4
That freezing is why the image can be shared. Every container started from an image gets the image's layers read-only, and one thin writable layer of its own on top. Ten containers from the same image do not cost ten copies of it. They cost the image, once, plus whatever each one has written since it started.

--- 5
Two things a container does not keep to itself. A volume mounts host storage into a path inside it, so data outlives the container that wrote it. A published port maps a port on the host to a port inside. Everything else is hidden by default, and both of those are things you asked for explicitly.

--- 6
So the honest summary. A container is not a small computer. It is a process with a restricted view, started from a frozen image, sharing the kernel of the machine it runs on. Everything that makes containers fast follows from the thing they do not do, which is boot an operating system.
