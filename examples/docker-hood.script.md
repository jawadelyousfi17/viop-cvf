--- 1
I'm guessing you've used Docker at least once, but have you ever wondered how it works under the hood? You write a Docker file, you build an image, and you run a container. Your code is now running completely cut off from the rest of your machine. It has its own file system, its own network interfaces, and its own process tree. The code behaves exactly the same on your laptop as it does on a production server, and usually that's enough. As long as the container spins up, we don't really care about what's under the hood. But in this video, we're going to see exactly what actually happens behind that docker run command.

--- 2
We often compare containers to virtual machines. A virtual machine uses a hypervisor to create an entirely simulated computer. It boots a kernel, loads hardware drivers, and runs a complete operating system from top to bottom. If you run 3 virtual machines on a single physical server, you have 3 separate kernels loaded in memory. That guarantees strong isolation, but it consumes a massive amount of memory and takes a long time to boot.

--- 3
A container is different. It never boots an operating system, and it doesn't need a kernel. It is just a normal Linux process. It runs directly on the host and shares the kernel with every other container on the machine. Since you skip the entire OS boot sequence, the container starts almost instantly and takes up only the memory your application actually uses.

--- 4
If a container is just a normal process, we face a problem. Usually, processes on a Linux machine can see each other. They share the same file system, the same network interfaces, and the same hostname. To make a single process behave like a self-contained environment, the kernel has to completely block its view of the rest of the host. It does this using a Linux feature called namespaces. Namespaces control what a process can see.

--- 5
Let's start with the PID namespace, which handles process IDs. Normally, your operating system keeps one giant list of every running program. If you start a web server, the kernel assigns it a unique number, like process 4500. Because it lives on that global list, your web server can technically look around and see every other application running on your machine. When you attach a PID namespace to that process, the kernel puts a wall around it. Now, when the web server asks the operating system what else is running, the kernel filters the response. The process sees an empty system and assumes it must be the very 1st program that booted up. It labels itself as process ID one, but if you open a terminal on your host machine, you will still see it sitting right there as process 4500. It is the exact same process, just experiencing a different reality.

--- 6
There are several other namespaces working together. The mount namespace gives the process its own isolated view of the file system. The network namespace gives it a private network stack. The UTS namespace lets the process have its own hostname. There are also namespaces for interprocess communication and user IDs. You can map the root user inside the container to an unprivileged user on the host. By combining these namespaces, the process is completely isolated from the rest of the host. It genuinely believes it has the entire computer to itself. Namespaces control visibility, but they do nothing about resources.

--- 7
A process isolated by namespaces can still consume all the host CPU and crash the machine. The Linux kernel solves this with control groups, usually called cgroups. While namespaces restrict what a process can see, cgroups restrict what a process can use. When you pass the memory or CPU flags to your Docker command, you are configuring these cgroups. Under the hood, the kernel manages them through a virtual file system.

--- 8
It creates a specific directory structure. You just write a number into a file, and that sets the exact resource limit for a process. From that moment on, the kernel tracks exactly how much RAM and CPU time the container consumes. When the container reaches for more memory than its limit allows, the kernel tries to free up room 1st by reclaiming memory the container is already holding. If that's not enough, it kills the process. This guarantees one runaway container cannot starve the rest of the server. We mentioned earlier that the mount namespace gives the container its own view of the file system, but to actually start, the process needs a root directory. We cannot let it use the host's, so we have to provide a completely separate one.

--- 9
Long before Docker existed, Unix systems handled this with a command called chroot. You point the process at a specific folder, and the kernel treats that folder as the absolute top of the file tree, so the process can't see anything outside that folder. But there is one major problem with chroot. It was never meant to be a security boundary. A process running as root can break out of it and get back to the host files. Modern container engines require something stronger, so they use a system call named pivot root. Instead of just restricting the view, pivot root completely replaces the root directory.

--- 10
The container gets a new isolated file system, and the host machine's original file tree is safely disconnected. But pivot root is just a mechanism for the swap. It secures the boundary, but that new root directory cannot be empty. It has to be pre-filled with system libraries and your application. Providing that fully packed environment is exactly what a Docker image does. But an image is not a single large file. It is a stack of independent layers combined using a union file system, most commonly overlay FS.

--- 11
When you write a Docker file, each instruction that changes the file system creates a layer. The base operating system is a layer. Installing a dependency adds another layer. Copying your source code adds one more. Instructions that only set metadata like ENV or CMD don't add anything to the file system. They just attach settings to the image. Overlay FS merges all these directories together, presenting them to the container as one unified file system. These image layers are strictly read-only. When you start a container, Docker adds a thin writable layer on top.

--- 12
If the container modifies an existing file, it never touches the original. Overlay FS copies that file up into the writable layer and changes the copy. The container thinks it edited the file, but in reality, it just stacked a new version on top and hid the old one underneath. This design saves massive amounts of disk space. If you run 10 containers from the same image, they all share the exact same read-only layers in memory and on disk. This also explains why the order of instructions in your Docker file matters. If you change a line near the top, Docker must rebuild that layer and every subsequent layer below it. We still need to explain how the container talks to the outside world. The network namespace left the container completely disconnected.

--- 13
It has its own network stack, but no physical network interface. Docker solves this by creating a virtual Ethernet pair. You can think of it as a virtual network cable. One end of the cable plugs into the container network namespace. The other end plugs into a virtual switch on the host machine called a bridge network, which by default is named docker0. When the container makes a request, the traffic travels through the virtual cable to the bridge. The host machine then routes that traffic to the physical network adapter. If 2 containers are connected to the same bridge, they can talk to each other directly using internal IP addresses. To expose a container to the public internet, you need to map ports.

--- 14
When you bind port 8080 on the host to port 80 in the container, Docker configures the host operating system to intercept traffic arriving at port 8080. The host uses network address translation to forward those packets through the bridge, across that virtual cable, and into the container. We have covered the core Linux features. We can now look at the actual architecture triggered by the docker run command. When you type the command, the Docker command line interface does not start the container.

--- 15
It makes an API call to a background service called the Docker daemon. The daemon manages images, networks, and storage volumes. It then passes the container specification to a component named containerd. Containerd manages the life cycle of the container. It handles downloading the image and unpacking the layers. Even containerd does not create the process itself. It hands the final configuration to a low-level tool called runc. The only job runc has is to talk to the Linux kernel.

--- 16
It sets up the namespaces, configures the cgroups, unpacks the root file system, and starts the process. Then the moment that process is running, runc immediately terminates. It builds the container and simply walks away. But on Linux, every process needs a parent. Since runc is gone, a small process called the shim takes over and adopts the container. It stays for the rest of the container's life. It keeps the process alive even if containerd restarts, and it grabs the exit code when the container finally stops. Let's summarize everything. A container is nothing but a regular Linux process. Namespaces isolate what it can see.

--- 17
Cgroups restrict what it can consume. Overlay FS handles layers to build its file system, and a virtual bridge wires it to the host network. I get asked all the time about how I build my animations, so if you want to learn how to do it yourself, check the link in the description. If you enjoyed this video, drop a like and subscribe, and please tell me in the comments what topic you want to see next. I'll pick the most liked one and make a video about it.
