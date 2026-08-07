'use client'

import {
  Call,
  Count,
  Crate,
  Die,
  Fade,
  Figure,
  Heading,
  Ink,
  Meter,
  Sheet,
  Switchbox,
  Type,
  Wall,
  Watch,
  box,
  clamp,
  ease,
  mix,
  rect,
  type Cue,
} from './ink'

/**
 * Seventeen plates, composed one at a time.
 *
 * Not generated from a board language — that is the point of this route. Each
 * scene is laid out for the sentences it has to carry, which is the one thing a
 * general renderer cannot do: the PID plate is a split reality because that is
 * what the narrator is describing, and the layer plate stacks upward because
 * that is what layers do. A DSL gets you a good board in seconds; a hand gets
 * you the right one.
 *
 * Every plate is a pure function of the clock. Nothing schedules.
 */

const W = 1600
const H = 900

/** Slow drift, so a still plate is never quite still. */
const drift = (p: number, x = 14, y = 8) =>
  `translate(${Math.sin(p * Math.PI) * x - x / 2} ${Math.cos(p * Math.PI * 0.8) * y - y / 2})`

export interface Plate {
  title: string
  render: (c: Cue) => React.ReactNode
}

export const PLATES: Plate[] = [
  // 1 ————————————————————————————— what happens behind docker run
  {
    title: 'Behind the command',
    render: (c) => (
      <g transform={drift(c.p)}>
        <g transform="translate(120 110)">
          <Heading n={1} of={17} title="Behind the command" k={c.at(1)} />
        </g>

        <g transform="translate(150 250)">
          <Ink d={box(0, 0, 470, 82, 3)} k={c.at(1, 1.1)} className="stroke hair" />
          <Fade k={c.at(1, 1.2)}>
            <text x={26} y={50} className="tech" fontSize={20} fill="var(--graphite)">
              $
            </text>
          </Fade>
          <Type x={52} y={50} text="docker run myapp" k={c.at(1, 1.4)} size={20} caret />
        </g>

        <g transform="translate(260 420)">
          <Crate k={c.at(2)} w={250} h={170} tone="hot" />
          <Fade k={c.at(2, 1.4)}>
            <text x={125} y={-22} textAnchor="middle" className="tech" fontSize={14} fill="var(--hot)">
              your container
            </text>
          </Fade>
          <Call x={-60} y={40} to={[0, 46]} text="its own file system" k={c.at(4)} align="end" />
          <Call x={-60} y={85} to={[0, 92]} text="its own network" k={c.at(4, 1.2)} align="end" />
          <Call x={-60} y={130} to={[0, 138]} text="its own process tree" k={c.at(4, 1.4)} align="end" />
          <Fade k={c.at(3)}>
            <text x={125} y={205} textAnchor="middle" className="tech" fontSize={13} fill="var(--graphite)">
              cut off from the rest of the machine
            </text>
          </Fade>
        </g>

        {/* The same bytes, two places. */}
        <g transform="translate(830 430)">
          <Fade k={c.at(5)}>
            <g>
              <Ink d={box(0, 40, 170, 110, 3)} k={c.at(5)} className="stroke" />
              <Ink d={`M40 150h90M56 150v22M114 150v22M30 172h110`} k={c.at(5, 1.3)} className="stroke hair" />
              <text x={85} y={104} textAnchor="middle" className="tech" fontSize={13} fill="var(--graphite)">
                your laptop
              </text>
            </g>
          </Fade>
          <Fade k={c.at(5, 1.2)}>
            <text x={230} y={110} textAnchor="middle" className="title" fontSize={54} fill="var(--hot)">
              =
            </text>
          </Fade>
          <Fade k={c.at(5, 1.4)}>
            <g transform="translate(300 40)">
              {[0, 40, 80].map((y, i) => (
                <g key={i}>
                  <Ink d={box(0, y, 170, 32, 2)} k={c.at(5, 1.5 + i * 0.15)} className="stroke" />
                  <circle cx={18} cy={y + 16} r={3} className="fillink" opacity={ease(c.at(5, 1.7))} />
                </g>
              ))}
              <text x={85} y={148} textAnchor="middle" className="tech" fontSize={13} fill="var(--graphite)">
                a production server
              </text>
            </g>
          </Fade>
        </g>

        <g transform="translate(150 780)">
          <Fade k={c.at(6)}>
            <text className="tech" fontSize={14} fill="var(--faint)">
              as long as it spins up, nobody looks underneath
            </text>
          </Fade>
        </g>
        <Fade k={c.at(7)}>
          <text x={W - 120} y={790} textAnchor="end" className="title" fontSize={52} fill="var(--hot)">
            so what is under there?
          </text>
        </Fade>
      </g>
    ),
  },

  // 2 ————————————————————————————— a virtual machine boots a computer
  {
    title: 'A whole computer, simulated',
    render: (c) => {
      const layers = [
        ['Physical server', 'cool'],
        ['Hypervisor', 'cool'],
        ['Guest kernel', 'hot'],
        ['Hardware drivers', 'hot'],
        ['A complete operating system', 'hot'],
        ['Your application', ''],
      ] as const
      return (
        <g transform={drift(c.p)}>
          <g transform="translate(120 110)">
            <Heading n={2} of={17} title="A whole computer, simulated" k={c.at(1)} />
          </g>
          <g transform="translate(180 250)">
            {layers.map(([name, tone], i) => {
              const k = c.at(i < 2 ? 2 : 3, 1 + i * 0.22)
              const y = (layers.length - 1 - i) * 68
              return (
                <g key={name} transform={`translate(0 ${y})`}>
                  <Ink d={box(0, 0, 420, 58, 2)} k={k} className={`stroke ${tone}`} />
                  <Fade k={clamp(k * 1.6 - 0.6)}>
                    <text x={22} y={36} className="tech" fontSize={15} fill="var(--ink)">
                      {name}
                    </text>
                  </Fade>
                </g>
              )
            })}
          </g>

          {/* Three of them, and therefore three kernels. */}
          <g transform="translate(700 250)">
            {[0, 1, 2].map((i) => (
              <Fade key={i} k={c.at(4, 1 + i * 0.3)}>
                <g transform={`translate(${i * 130} ${i * 14})`}>
                  <Ink d={box(0, 0, 110, 408, 2)} k={c.at(4, 1 + i * 0.3)} className="stroke hair" />
                  <Ink d={box(10, 250, 90, 40, 2)} k={c.at(4, 1.3 + i * 0.3)} className="stroke hot" />
                  <text x={55} y={276} textAnchor="middle" className="tech" fontSize={10} fill="var(--hot)">
                    kernel
                  </text>
                </g>
              </Fade>
            ))}
            <Fade k={c.at(4, 1.9)}>
              <text x={195} y={468} textAnchor="middle" className="tech" fontSize={13} fill="var(--hot)">
                three separate kernels in memory
              </text>
            </Fade>
          </g>

          <g transform="translate(1180 300)">
            <Fade k={c.at(5)}>
              <text className="micro" y={-14}>
                the bill
              </text>
            </Fade>
            <g transform="translate(0 20)">
              <Count x={0} y={44} to={3} k={c.at(5, 1.1)} suffix=" GB" size={44} tone="var(--hot)" />
              <Fade k={c.at(5, 1.1)}>
                <text x={0} y={70} className="tech" fontSize={12} fill="var(--faint)">
                  of memory, each
                </text>
              </Fade>
            </g>
            <g transform="translate(0 150)">
              <Watch k={c.at(5, 1.3)} spin={ease(c.at(5, 1.6)) * 3} />
              <Fade k={c.at(5, 1.3)}>
                <text x={0} y={106} className="tech" fontSize={12} fill="var(--faint)">
                  a long time to boot
                </text>
              </Fade>
            </g>
            <Fade k={c.at(5, 1.8)}>
              <text x={0} y={330} className="tech" fontSize={13} fill="var(--good)">
                it does isolate well
              </text>
            </Fade>
          </g>
        </g>
      )
    },
  },

  // 3 ————————————————————————————— a container is just a process
  {
    title: 'Just a process',
    render: (c) => (
      <g transform={drift(c.p)}>
        <g transform="translate(120 110)">
          <Heading n={3} of={17} title="Just a process" k={c.at(1)} />
        </g>

        <Fade k={c.at(1)}>
          <text x={150} y={250} className="tech" fontSize={15} fill="var(--graphite)">
            no operating system, no kernel of its own
          </text>
        </Fade>

        {/* One line for the host, one small box standing on it. */}
        <g transform="translate(200 560)">
          <Ink d={`M0 0H1200`} k={c.at(1, 1.2)} className="stroke" />
          <Fade k={c.at(1, 1.4)}>
            <text x={0} y={30} className="micro">
              the host
            </text>
          </Fade>

          <g transform="translate(120 -110)">
            <Crate k={c.at(2)} w={150} h={104} tone="hot" />
            <Fade k={c.at(2, 1.4)}>
              <text x={75} y={-20} textAnchor="middle" className="tech" fontSize={13} fill="var(--hot)">
                one ordinary process
              </text>
            </Fade>
          </g>

          <g transform="translate(560 -96)">
            <Die k={c.at(4)} s={92} />
            <Fade k={c.at(4, 1.4)}>
              <text x={46} y={116} textAnchor="middle" className="tech" fontSize={13} fill="var(--cool)">
                the host kernel
              </text>
            </Fade>
          </g>

          <Ink
            d={`M270 -58H600`}
            k={c.at(4, 1.2)}
            className="stroke hair cool"
            style={{ strokeDasharray: '6 6' }}
          />
          <Fade k={c.at(4, 1.5)}>
            <text x={435} y={-70} textAnchor="middle" className="tech" fontSize={12} fill="var(--cool)">
              shared with every container
            </text>
          </Fade>

          <g transform="translate(880 -150)">
            <Watch k={c.at(5)} spin={ease(c.at(5, 1.2)) * 6} r={40} />
            <Fade k={c.at(5, 1.4)}>
              <text x={40} y={122} textAnchor="middle" className="tech" fontSize={13} fill="var(--good)">
                starts almost instantly
              </text>
              <text x={40} y={144} textAnchor="middle" className="tech" fontSize={12} fill="var(--faint)">
                only the memory it actually uses
              </text>
            </Fade>
          </g>
        </g>
      </g>
    ),
  },

  // 4 ————————————————————————————— but processes can see each other
  {
    title: 'Everyone can see everyone',
    render: (c) => {
      const dots = [
        [220, 300], [420, 250], [640, 320], [860, 260], [1060, 330], [400, 440], [780, 450], [1000, 470],
      ] as const
      return (
        <g transform={drift(c.p)}>
          <g transform="translate(120 110)">
            <Heading n={4} of={17} title="Everyone can see everyone" k={c.at(1)} />
          </g>

          <g transform="translate(60 200)">
            {dots.map(([x, y], i) => (
              <g key={i}>
                <Fade k={c.at(1, 1 + i * 0.08)}>
                  <circle cx={x} cy={y} r={9} className="stroke" fill="var(--paper)" strokeWidth={2} />
                </Fade>
                {i > 0 && (
                  <Ink
                    d={`M${dots[0][0]} ${dots[0][1]}L${x} ${y}`}
                    k={clamp(c.at(2, 1 + i * 0.1))}
                    className="stroke hair ghosted"
                  />
                )}
              </g>
            ))}
            <Fade k={c.at(3)}>
              <text x={640} y={560} textAnchor="middle" className="tech" fontSize={14} fill="var(--graphite)">
                same file system · same interfaces · same hostname
              </text>
            </Fade>
          </g>

          {/* The wall goes up around one of them. */}
          <g transform="translate(180 400)">
            <Fade k={c.at(4)}>
              <g opacity={0.14}>
                <rect x={-40} y={-70} width={260} height={220} className="washhot" />
              </g>
            </Fade>
            <g transform="translate(-40 -70)">
              <Wall k={c.at(4, 1.1)} w={260} h={44} />
              <Wall k={c.at(4, 1.3)} w={260} h={44} />
            </g>
            <Ink d={rect(-40, -70, 260, 220)} k={c.at(4, 1.2)} className="stroke hot" />
          </g>

          <g transform="translate(1000 640)">
            <Fade k={c.at(5)}>
              <text className="title" fontSize={64} fill="var(--hot)">
                namespaces
              </text>
              <text y={36} className="tech" fontSize={13} fill="var(--graphite)">
                the kernel blocks its view of everything else
              </text>
            </Fade>
            <Fade k={c.at(6)}>
              <text y={80} className="tech" fontSize={13} fill="var(--faint)">
                sight, not appetite
              </text>
            </Fade>
          </g>
        </g>
      )
    },
  },

  // 5 ————————————————————————————— the PID namespace
  {
    title: 'One process, two realities',
    render: (c) => {
      const rows = [
        ['1', 'systemd'],
        ['842', 'sshd'],
        ['1204', 'cron'],
        ['4500', 'your web server'],
        ['5120', 'postgres'],
      ] as const
      return (
        <g transform={drift(c.p, 8, 6)}>
          <g transform="translate(120 100)">
            <Heading n={5} of={17} title="One process, two realities" k={c.at(1)} />
          </g>

          {/* The global list. */}
          <g transform="translate(140 230)">
            <Fade k={c.at(2)}>
              <text className="micro" y={-16}>
                every running program
              </text>
            </Fade>
            {rows.map(([pid, name], i) => {
              const mine = pid === '4500'
              const k = c.at(2, 1 + i * 0.14)
              return (
                <g key={pid} transform={`translate(0 ${i * 52})`}>
                  <Ink d={box(0, 0, 400, 42, 2)} k={k} className={`stroke ${mine ? 'hot' : 'hair'}`} />
                  <Fade k={clamp(k * 1.6 - 0.6)}>
                    <text x={18} y={27} className="tech" fontSize={14} fill={mine ? 'var(--hot)' : 'var(--graphite)'}>
                      {pid}
                    </text>
                    <text x={110} y={27} className="tech" fontSize={14} fill="var(--graphite)">
                      {name}
                    </text>
                  </Fade>
                </g>
              )
            })}
            <Call x={470} y={172} to={[400, 172]} text="it can see all of this" k={c.at(4)} tone="hot" />
          </g>

          {/* The wall, and then the two views. */}
          <g transform="translate(700 250)">
            <Fade k={c.at(5)}>
              <g transform="translate(0 60)">
                <Wall k={c.at(5)} w={90} h={230} />
              </g>
            </Fade>
            <Fade k={c.at(6)}>
              <text x={45} y={330} textAnchor="middle" className="tech" fontSize={12} fill="var(--hot)">
                the kernel filters
              </text>
              <text x={45} y={350} textAnchor="middle" className="tech" fontSize={12} fill="var(--hot)">
                the answer
              </text>
            </Fade>
          </g>

          <g transform="translate(880 220)">
            <Fade k={c.at(7)}>
              <g>
                <Ink d={box(0, 0, 300, 210, 3)} k={c.at(7)} className="stroke hot" />
                <text x={150} y={-16} textAnchor="middle" className="micro">
                  what it sees
                </text>
                <text x={150} y={80} textAnchor="middle" className="tech" fontSize={13} fill="var(--faint)">
                  an empty system
                </text>
              </g>
            </Fade>
            <Fade k={c.at(8)}>
              <text x={150} y={140} textAnchor="middle" className="title" fontSize={52} fill="var(--hot)">
                PID 1
              </text>
            </Fade>

            <Fade k={c.at(7, 1.3)}>
              <g transform="translate(0 260)">
                <Ink d={box(0, 0, 300, 210, 3)} k={c.at(7, 1.3)} className="stroke cool" />
                <text x={150} y={-16} textAnchor="middle" className="micro">
                  what the host sees
                </text>
                <text x={150} y={80} textAnchor="middle" className="tech" fontSize={13} fill="var(--faint)">
                  sitting right there
                </text>
              </g>
            </Fade>
            <Fade k={c.at(8, 1.2)}>
              <text x={150} y={400} textAnchor="middle" className="title" fontSize={52} fill="var(--cool)">
                PID 4500
              </text>
            </Fade>
          </g>

          <Fade k={c.at(9)}>
            <text x={1300} y={560} textAnchor="middle" className="tech" fontSize={14} fill="var(--ink)">
              the same process
            </text>
            <text x={1300} y={584} textAnchor="middle" className="tech" fontSize={14} fill="var(--graphite)">
              experiencing a different reality
            </text>
          </Fade>
        </g>
      )
    },
  },

  // 6 ————————————————————————————— the other namespaces
  {
    title: 'And the rest of them',
    render: (c) => {
      const kinds = [
        ['mount', 'its own view of the file system'],
        ['network', 'a private network stack'],
        ['UTS', 'its own hostname'],
        ['IPC', 'its own message queues'],
        ['user', 'root inside, nobody outside'],
      ] as const
      return (
        <g transform={drift(c.p)}>
          <g transform="translate(120 110)">
            <Heading n={6} of={17} title="And the rest of them" k={c.at(1)} />
          </g>
          <g transform="translate(150 250)">
            {kinds.map(([name, what], i) => {
              const k = c.at(2 + i)
              return (
                <g key={name} transform={`translate(0 ${i * 92})`}>
                  <Ink d={`M0 42H${mix(0, 900, ease(k))}`} k={1} className="stroke hair" />
                  <Fade k={k}>
                    <g transform="translate(0 8)">
                      <Wall k={k} w={54} h={26} tone={i === 4 ? 'cool' : 'hot'} />
                    </g>
                    <text x={82} y={30} className="tech" fontSize={22} fill="var(--ink)">
                      {name}
                    </text>
                    <text x={330} y={30} className="tech" fontSize={14} fill="var(--graphite)">
                      {what}
                    </text>
                  </Fade>
                </g>
              )
            })}
          </g>

          <g transform="translate(1160 300)">
            <Fade k={c.at(7)}>
              <Crate k={c.at(7)} w={220} h={150} tone="hot" />
              <text x={110} y={-20} textAnchor="middle" className="tech" fontSize={13} fill="var(--hot)">
                combined
              </text>
            </Fade>
            <Fade k={c.at(8)}>
              <text x={110} y={210} textAnchor="middle" className="tech" fontSize={14} fill="var(--ink)">
                it believes it has
              </text>
              <text x={110} y={234} textAnchor="middle" className="tech" fontSize={14} fill="var(--ink)">
                the whole computer
              </text>
            </Fade>
            <Fade k={c.at(9)}>
              <g transform="translate(76 280)">
                <Figure k={c.at(9)} />
              </g>
            </Fade>
          </g>
        </g>
      )
    },
  },

  // 7 ————————————————————————————— seeing is not consuming
  {
    title: 'Seeing is not consuming',
    render: (c) => (
      <g transform={drift(c.p)}>
        <g transform="translate(120 110)">
          <Heading n={7} of={17} title="Seeing is not consuming" k={c.at(1)} />
        </g>

        <g transform="translate(200 300)">
          <Fade k={c.at(2)}>
            <Crate k={c.at(2)} w={230} h={150} tone="hot" />
            <text x={115} y={-18} textAnchor="middle" className="tech" fontSize={13} fill="var(--hot)">
              isolated, and still greedy
            </text>
          </Fade>
          <g transform="translate(300 20)">
            <Meter k={c.at(2, 1.2)} value={ease(c.at(2, 1.4))} r={56} />
            <Fade k={c.at(2, 1.6)}>
              <text x={56} y={140} textAnchor="middle" className="tech" fontSize={13} fill="var(--hot)">
                every CPU on the host
              </text>
            </Fade>
          </g>
          <Fade k={c.at(2, 1.8)}>
            <text x={210} y={250} textAnchor="middle" className="tech" fontSize={14} fill="var(--graphite)">
              and it can crash the machine
            </text>
          </Fade>
        </g>

        <g transform="translate(830 280)">
          <Fade k={c.at(3)}>
            <text className="title" fontSize={58} fill="var(--amber)">
              cgroups
            </text>
            <text y={34} className="tech" fontSize={13} fill="var(--graphite)">
              control groups
            </text>
          </Fade>

          <g transform="translate(0 130)">
            {[
              ['namespaces', 'restrict what it can see', 'hot'],
              ['cgroups', 'restrict what it can use', 'amber'],
            ].map(([a, b, tone], i) => (
              <g key={a} transform={`translate(0 ${i * 120})`}>
                <Ink d={box(0, 0, 560, 92, 3)} k={c.at(4, 1 + i * 0.35)} className={`stroke ${tone}`} />
                <Fade k={c.at(4, 1.3 + i * 0.35)}>
                  <text x={26} y={40} className="tech" fontSize={20} fill={`var(--${tone})`}>
                    {a}
                  </text>
                  <text x={26} y={68} className="tech" fontSize={14} fill="var(--graphite)">
                    {b}
                  </text>
                </Fade>
              </g>
            ))}
          </g>

          <Fade k={c.at(5)}>
            <text y={430} className="tech" fontSize={14} fill="var(--faint)">
              the --memory and --cpus flags configure exactly these
            </text>
          </Fade>
        </g>
      </g>
    ),
  },

  // 8 ————————————————————————————— how a limit is actually set
  {
    title: 'A number in a file',
    render: (c) => {
      const over = ease(c.at(6))
      const value = mix(0.42, 1, ease(c.at(6, 1.1)))
      return (
        <g transform={drift(c.p)}>
          <g transform="translate(120 110)">
            <Heading n={8} of={17} title="A number in a file" k={c.at(1)} />
          </g>

          <g transform="translate(150 250)">
            <Fade k={c.at(2)}>
              <text className="micro" y={-14}>
                a virtual file system
              </text>
            </Fade>
            {['/sys/fs/cgroup/', '  docker/', '    a3f9…/', '      memory.max', '      cpu.max'].map(
              (line, i) => (
                <Fade key={line} k={c.at(2, 1 + i * 0.18)}>
                  <text
                    x={0}
                    y={i * 34 + 14}
                    className="tech"
                    fontSize={15}
                    fill={i >= 3 ? 'var(--amber)' : 'var(--graphite)'}
                  >
                    {line}
                  </text>
                </Fade>
              )
            )}

            <g transform="translate(0 220)">
              <Ink d={box(0, 0, 560, 66, 2)} k={c.at(3)} className="stroke amber" />
              <Type x={22} y={42} text="echo 536870912 > memory.max" k={c.at(3, 1.3)} size={17} />
            </g>
            <Fade k={c.at(4)}>
              <text y={330} className="tech" fontSize={14} fill="var(--graphite)">
                that is the whole mechanism
              </text>
            </Fade>
          </g>

          <g transform="translate(880 270)">
            <Meter k={c.at(5)} value={value} r={92} />
            <Fade k={c.at(5, 1.3)}>
              <text x={92} y={230} textAnchor="middle" className="tech" fontSize={13} fill="var(--graphite)">
                the kernel tracks every byte
              </text>
            </Fade>

            <g transform="translate(300 20)" opacity={over}>
              <Ink d={box(0, 0, 300, 76, 3)} k={c.at(6)} className="stroke amber" />
              <Fade k={c.at(6, 1.3)}>
                <text x={150} y={46} textAnchor="middle" className="tech" fontSize={14} fill="var(--amber)">
                  reclaim first
                </text>
              </Fade>

              <Ink d={`M150 90V130`} k={c.at(7)} className="stroke hair" />
              <Ink d={box(0, 130, 300, 76, 3)} k={c.at(7)} className="stroke hot" />
              <Fade k={c.at(7, 1.3)}>
                <text x={150} y={176} textAnchor="middle" className="tech" fontSize={14} fill="var(--hot)">
                  then kill it
                </text>
              </Fade>
              {/* The cross, drawn as two decisive strokes. */}
              <Ink d={`M116 148l32 32`} k={c.at(7, 1.4)} className="stroke hot heavy" />
              <Ink d={`M148 148l-32 32`} k={c.at(7, 1.6)} className="stroke hot heavy" />
            </g>
          </g>

          <Fade k={c.at(8)}>
            <text x={W / 2} y={830} textAnchor="middle" className="tech" fontSize={15} fill="var(--good)">
              one runaway container cannot starve the server
            </text>
          </Fade>
        </g>
      )
    },
  },

  // 9 ————————————————————————————— it still needs a root directory
  {
    title: 'It still needs a root',
    render: (c) => (
      <g transform={drift(c.p)}>
        <g transform="translate(120 110)">
          <Heading n={9} of={17} title="It still needs a root" k={c.at(1)} />
        </g>

        {/* The host tree. */}
        <g transform="translate(180 250)">
          <Fade k={c.at(1)}>
            <text className="micro" y={-14}>
              the host file tree
            </text>
          </Fade>
          <Ink d={`M20 0V420`} k={c.at(1, 1.1)} className="stroke hair" />
          {['/', '/etc', '/usr', '/var', '/home', '/opt'].map((name, i) => (
            <g key={name} transform={`translate(0 ${i * 70 + 20})`}>
              <Ink d={`M20 0H70`} k={c.at(1, 1.2 + i * 0.1)} className="stroke hair" />
              <Fade k={c.at(1, 1.4 + i * 0.1)}>
                <text x={82} y={6} className="tech" fontSize={16} fill="var(--graphite)">
                  {name}
                </text>
              </Fade>
            </g>
          ))}
          <Fade k={c.at(2)}>
            <text y={470} className="tech" fontSize={13} fill="var(--hot)">
              we cannot lend it this one
            </text>
          </Fade>
        </g>

        {/* chroot: a subtree boxed off. */}
        <g transform="translate(620 250)">
          <Fade k={c.at(3)}>
            <text className="micro" y={-14}>
              long before docker
            </text>
            <text y={26} className="title" fontSize={40} fill="var(--ink)">
              chroot
            </text>
          </Fade>
          <g transform="translate(0 60)">
            <Ink d={box(0, 0, 330, 240, 3)} k={c.at(4)} className="stroke" />
            <Fade k={c.at(4, 1.3)}>
              <text x={165} y={130} textAnchor="middle" className="tech" fontSize={14} fill="var(--graphite)">
                the top of the tree, as far
              </text>
              <text x={165} y={154} textAnchor="middle" className="tech" fontSize={14} fill="var(--graphite)">
                as this process knows
              </text>
            </Fade>
          </g>
        </g>

        {/* And the way out of it. */}
        <g transform="translate(1080 300)">
          <Fade k={c.at(5)}>
            <text className="tech" fontSize={15} fill="var(--hot)">
              never a security boundary
            </text>
          </Fade>
          <Ink
            d={`M0 60C60 60 40 140 130 140S250 60 320 60`}
            k={c.at(6)}
            className="stroke hot heavy"
          />
          <Ink d={`M300 46l24 14-24 14`} k={c.at(6, 1.5)} className="stroke hot heavy" />
          <Fade k={c.at(6, 1.4)}>
            <text y={190} className="tech" fontSize={13} fill="var(--graphite)">
              a process running as root
            </text>
            <text y={212} className="tech" fontSize={13} fill="var(--graphite)">
              can climb back out
            </text>
          </Fade>
          <Fade k={c.at(7)}>
            <text y={290} className="tech" fontSize={14} fill="var(--ink)">
              so engines use something stronger
            </text>
          </Fade>
        </g>
      </g>
    ),
  },

  // 10 ———————————————————————————— pivot_root
  {
    title: 'Swap the root entirely',
    render: (c) => {
      const swing = ease(c.at(3))
      return (
        <g transform={drift(c.p)}>
          <g transform="translate(120 110)">
            <Heading n={10} of={17} title="Swap the root entirely" k={c.at(1)} />
          </g>

          <g transform="translate(150 260)">
            <Ink d={box(0, 0, 420, 74, 3)} k={c.at(1, 1.1)} className="stroke cool" />
            <Type x={26} y={46} text="pivot_root(new, old)" k={c.at(1, 1.4)} size={19} />
          </g>

          <g transform="translate(150 400)">
            {[
              ['chroot', 'restricts the view', ''],
              ['pivot_root', 'replaces the root', 'cool'],
            ].map(([a, b, tone], i) => (
              <g key={a} transform={`translate(0 ${i * 108})`}>
                <Ink d={box(0, 0, 420, 84, 3)} k={c.at(2, 1 + i * 0.3)} className={`stroke ${tone || 'hair'}`} />
                <Fade k={c.at(2, 1.3 + i * 0.3)}>
                  <text x={24} y={36} className="tech" fontSize={18} fill={tone ? 'var(--cool)' : 'var(--graphite)'}>
                    {a}
                  </text>
                  <text x={24} y={62} className="tech" fontSize={13} fill="var(--faint)">
                    {b}
                  </text>
                </Fade>
              </g>
            ))}
          </g>

          {/* The old tree swings away; the new one takes its place. */}
          <g transform="translate(760 250)">
            <g
              transform={`translate(${swing * 240} ${swing * 90}) rotate(${swing * 16} 150 200)`}
              opacity={1 - swing * 0.75}
            >
              <Ink d={box(0, 0, 300, 400, 3)} k={c.at(1, 1.2)} className="stroke hair" />
              <Fade k={c.at(1, 1.5)}>
                <text x={150} y={210} textAnchor="middle" className="tech" fontSize={14} fill="var(--faint)">
                  the host&rsquo;s original tree
                </text>
              </Fade>
              <Fade k={c.at(3, 1.4)}>
                <text x={150} y={240} textAnchor="middle" className="tech" fontSize={12} fill="var(--faint)">
                  safely disconnected
                </text>
              </Fade>
            </g>

            <Fade k={c.at(4)}>
              <g>
                <Ink d={box(0, 0, 300, 400, 3)} k={c.at(4)} className="stroke cool" />
                <text x={150} y={-16} textAnchor="middle" className="micro">
                  the new root
                </text>
              </g>
            </Fade>
            <Fade k={c.at(5)}>
              <text x={150} y={200} textAnchor="middle" className="tech" fontSize={14} fill="var(--hot)">
                but it cannot be empty
              </text>
            </Fade>

            {/* It fills. */}
            {['/bin', '/lib', '/usr', 'your app'].map((name, i) => (
              <Fade key={name} k={c.at(6, 1 + i * 0.22)}>
                <g transform={`translate(30 ${60 + i * 62})`}>
                  <Ink d={box(0, 0, 240, 46, 2)} k={c.at(6, 1 + i * 0.22)} className="stroke hair cool" />
                  <text x={16} y={30} className="tech" fontSize={14} fill="var(--graphite)">
                    {name}
                  </text>
                </g>
              </Fade>
            ))}
          </g>

          <Fade k={c.at(7)}>
            <text x={1200} y={760} textAnchor="middle" className="title" fontSize={44} fill="var(--ink)">
              a docker image
            </text>
            <text x={1200} y={794} textAnchor="middle" className="tech" fontSize={13} fill="var(--graphite)">
              is exactly that, pre-filled
            </text>
          </Fade>
        </g>
      )
    },
  },

  // 11 ———————————————————————————— layers
  {
    title: 'A stack of layers',
    render: (c) => {
      const layers = [
        ['FROM python:3.12', 'the base operating system', 4],
        ['RUN pip install', 'a dependency', 5],
        ['COPY . /app', 'your source code', 6],
      ] as const
      const merge = ease(c.at(8))
      return (
        <g transform={drift(c.p)}>
          <g transform="translate(120 110)">
            <Heading n={11} of={17} title="A stack of layers" k={c.at(1)} />
          </g>

          <Fade k={c.at(2)}>
            <text x={150} y={238} className="tech" fontSize={15} fill="var(--graphite)">
              not one large file — a stack of independent layers
            </text>
          </Fade>

          {/* The stack builds upward, each instruction its own course. */}
          <g transform="translate(170 610)">
            {layers.map(([cmd, what, beat], i) => {
              const k = c.at(beat as number)
              const lift = (1 - ease(k)) * 40
              return (
                <g key={cmd} transform={`translate(0 ${-i * 96 + lift})`}>
                  <Ink d={box(0, 0, 520, 78, 2)} k={k} className="stroke" />
                  <Fade k={clamp(k * 1.5 - 0.5)}>
                    <text x={22} y={34} className="tech" fontSize={17} fill="var(--ink)">
                      {cmd}
                    </text>
                    <text x={22} y={60} className="tech" fontSize={13} fill="var(--faint)">
                      {what}
                    </text>
                  </Fade>
                </g>
              )
            })}
            {/* Clear of everything, under the stack it is about. */}
            <Fade k={c.at(7)}>
              <text x={0} y={132} className="tech" fontSize={13} fill="var(--faint)">
                ENV and CMD add nothing to the file system —
              </text>
              <text x={0} y={156} className="tech" fontSize={13} fill="var(--faint)">
                they only attach settings to the image
              </text>
            </Fade>
          </g>

          {/* overlayfs gathers the courses into one surface. */}
          <g transform="translate(1000 300)">
            <Fade k={c.at(8)}>
              <text className="title" fontSize={42} fill="var(--cool)">
                overlayfs
              </text>
              <text y={32} className="tech" fontSize={13} fill="var(--graphite)">
                a union file system
              </text>
            </Fade>

            {/* The gathering lines only exist once there is something to gather
                into — three strokes pointing at empty paper is worse than none. */}
            <g transform="translate(-140 160)">
              {[0, 1, 2].map((i) => (
                <Ink
                  key={i}
                  d={`M0 ${i * 96}Q120 ${i * 96} 200 ${96 + (i - 1) * 8}`}
                  k={clamp(merge * 1.4 - i * 0.12)}
                  className="stroke hair cool"
                />
              ))}
              <Fade k={c.at(9)}>
                <g transform="translate(210 52)">
                  <Ink d={box(0, 0, 330, 92, 3)} k={c.at(9)} className="stroke cool" />
                  <text x={165} y={54} textAnchor="middle" className="tech" fontSize={16} fill="var(--cool)">
                    one file system
                  </text>
                </g>
              </Fade>
            </g>
          </g>
        </g>
      )
    },
  },

  // 12 ———————————————————————————— read-only, plus one writable layer
  {
    title: 'Frozen, plus one thin layer',
    render: (c) => {
      const lift = ease(c.at(4))
      return (
        <g transform={drift(c.p)}>
          <g transform="translate(120 110)">
            <Heading n={12} of={17} title="Frozen, plus one thin layer" k={c.at(1)} />
          </g>

          <g transform="translate(190 400)">
            {[0, 1, 2].map((i) => (
              <g key={i} transform={`translate(0 ${(2 - i) * 74 + 60})`}>
                <Ink d={box(0, 0, 460, 62, 2)} k={c.at(1, 1 + i * 0.2)} className="stroke hair" />
                <Fade k={c.at(1, 1.3 + i * 0.2)}>
                  <text x={20} y={38} className="tech" fontSize={14} fill="var(--faint)">
                    read-only layer
                  </text>
                </Fade>
              </g>
            ))}
            {/* The thin writable one. */}
            <g transform="translate(0 22)">
              <Ink d={box(0, 0, 460, 30, 2)} k={c.at(2)} className="stroke hot" />
              <Fade k={c.at(2, 1.3)}>
                <text x={20} y={21} className="tech" fontSize={13} fill="var(--hot)">
                  thin writable layer
                </text>
              </Fade>
            </g>

            {/* copy-up: the file rises from a lower layer to the top. */}
            <g transform={`translate(${520} ${230 - lift * 200})`} opacity={ease(c.at(3))}>
              <Sheet k={c.at(3)} tone={lift > 0.5 ? 'hot' : ''} />
            </g>
            <Ink
              d={`M544 240C600 200 600 120 544 60`}
              k={c.at(4)}
              className="stroke hair hot"
            />
            <Fade k={c.at(5)}>
              <text x={620} y={140} className="tech" fontSize={13} fill="var(--hot)">
                copied up, then changed
              </text>
              <text x={620} y={164} className="tech" fontSize={13} fill="var(--graphite)">
                the original is never touched
              </text>
            </Fade>
          </g>

          {/* Ten containers, one stack. */}
          <g transform="translate(980 300)">
            <Fade k={c.at(6)}>
              <text className="micro" y={-16}>
                ten containers
              </text>
            </Fade>
            {Array.from({ length: 10 }, (_, i) => (
              <Fade key={i} k={c.at(6, 1 + i * 0.06)}>
                <g transform={`translate(${(i % 5) * 84} ${Math.floor(i / 5) * 74})`}>
                  <Ink d={box(0, 0, 68, 30, 2)} k={c.at(6, 1 + i * 0.06)} className="stroke hot" />
                </g>
              </Fade>
            ))}
            <Fade k={c.at(7)}>
              <text y={210} className="tech" fontSize={14} fill="var(--good)">
                one copy of the layers, shared
              </text>
              <text y={234} className="tech" fontSize={13} fill="var(--faint)">
                on disk and in memory
              </text>
            </Fade>
            <Fade k={c.at(8)}>
              <g transform="translate(0 300)">
                <Ink d={box(0, 0, 420, 96, 3)} k={c.at(8)} className="stroke amber" />
                <text x={20} y={38} className="tech" fontSize={14} fill="var(--amber)">
                  which is why order matters
                </text>
                <text x={20} y={66} className="tech" fontSize={13} fill="var(--graphite)">
                  change a line near the top and everything below rebuilds
                </text>
              </g>
            </Fade>
          </g>
        </g>
      )
    },
  },

  // 13 ———————————————————————————— the cable and the bridge
  {
    title: 'A cable to a switch',
    render: (c) => {
      const flow = (c.t * 0.6) % 1
      return (
        <g transform={drift(c.p)}>
          <g transform="translate(120 110)">
            <Heading n={13} of={17} title="A cable to a switch" k={c.at(1)} />
          </g>

          <Fade k={c.at(2)}>
            <text x={150} y={250} className="tech" fontSize={15} fill="var(--graphite)">
              its own network stack — and no interface at all
            </text>
          </Fade>

          <g transform="translate(170 400)">
            <Crate k={c.at(1, 1.2)} w={220} h={150} tone="hot" />
            <Fade k={c.at(1, 1.5)}>
              <text x={110} y={-18} textAnchor="middle" className="tech" fontSize={13} fill="var(--hot)">
                the container
              </text>
            </Fade>
          </g>

          {/* veth pair: one cable, two ends. */}
          <g transform="translate(390 470)">
            <Ink d={`M0 0C120 0 140 60 260 60`} k={c.at(4)} className="stroke heavy" />
            <circle cx={0} cy={0} r={5} className="fillink" opacity={ease(c.at(4))} />
            <circle cx={260} cy={60} r={5} className="fillink" opacity={ease(c.at(4, 1.4))} />
            <Fade k={c.at(4, 1.3)}>
              <text x={130} y={-24} textAnchor="middle" className="tech" fontSize={13} fill="var(--ink)">
                a virtual ethernet pair
              </text>
            </Fade>
            {/* Traffic, once the cable exists. */}
            <circle
              r={4}
              className="fillhot"
              opacity={ease(c.at(7))}
              cx={mix(0, 260, flow)}
              cy={mix(0, 60, flow)}
            />
          </g>

          <g transform="translate(660 500)">
            <Switchbox k={c.at(6)} w={230} h={70} />
            <Fade k={c.at(6, 1.3)}>
              <text x={115} y={-18} textAnchor="middle" className="tech" fontSize={14} fill="var(--cool)">
                docker0
              </text>
              <text x={115} y={100} textAnchor="middle" className="tech" fontSize={12} fill="var(--faint)">
                a bridge on the host
              </text>
            </Fade>
          </g>

          <g transform="translate(1000 500)">
            <Ink d={`M0 35H190`} k={c.at(8)} className="stroke" />
            <Ink d={`M170 25l22 10-22 10`} k={c.at(8, 1.4)} className="stroke" />
            <g transform="translate(210 0)">
              <Ink d={box(0, 0, 200, 70, 3)} k={c.at(8, 1.2)} className="stroke" />
              <Fade k={c.at(8, 1.5)}>
                <text x={100} y={42} textAnchor="middle" className="tech" fontSize={13} fill="var(--graphite)">
                  physical adapter
                </text>
              </Fade>
            </g>
          </g>

          <Fade k={c.at(9)}>
            <text x={W / 2} y={800} textAnchor="middle" className="tech" fontSize={14} fill="var(--faint)">
              two containers on one bridge reach each other directly
            </text>
          </Fade>
        </g>
      )
    },
  },

  // 14 ———————————————————————————— ports and NAT
  {
    title: 'Opening one door',
    render: (c) => (
      <g transform={drift(c.p)}>
        <g transform="translate(120 110)">
          <Heading n={14} of={17} title="Opening one door" k={c.at(1)} />
        </g>

        <g transform="translate(180 300)">
          <Ink d={box(0, 0, 520, 400, 4)} k={c.at(1, 1.1)} className="stroke hair" />
          <Fade k={c.at(1, 1.4)}>
            <text x={20} y={-16} className="micro">
              one bridge
            </text>
          </Fade>
          {[0, 1].map((i) => (
            <g key={i} transform={`translate(${60 + i * 250} 90)`}>
              <Crate k={c.at(1, 1.2 + i * 0.2)} w={160} h={110} tone="hot" />
            </g>
          ))}
          <Ink d={`M220 145H310`} k={c.at(1, 1.8)} className="stroke hair" />
          <Fade k={c.at(1, 2)}>
            <text x={260} y={130} textAnchor="middle" className="tech" fontSize={11} fill="var(--faint)">
              internal IPs
            </text>
          </Fade>
        </g>

        <g transform="translate(800 320)">
          <Fade k={c.at(2)}>
            <text className="title" fontSize={38} fill="var(--ink)">
              to reach the outside
            </text>
          </Fade>
          <g transform="translate(0 70)">
            <Ink d={box(0, 0, 560, 74, 3)} k={c.at(3)} className="stroke cool" />
            <Type x={24} y={46} text="docker run -p 8080:80 myapp" k={c.at(3, 1.3)} size={18} />
          </g>

          <g transform="translate(0 200)">
            <Fade k={c.at(4)}>
              <text className="tech" fontSize={15} fill="var(--graphite)">
                host 8080
              </text>
            </Fade>
            <Ink d={`M120 -6H250`} k={c.at(4, 1.2)} className="stroke cool" />
            <Ink d={`M230 -14l22 8-22 8`} k={c.at(4, 1.5)} className="stroke cool" />
            <g transform="translate(270 -40)">
              <Ink d={box(0, 0, 130, 66, 3)} k={c.at(4, 1.3)} className="stroke cool" />
              <Fade k={c.at(4, 1.5)}>
                <text x={65} y={40} textAnchor="middle" className="tech" fontSize={13} fill="var(--cool)">
                  NAT
                </text>
              </Fade>
            </g>
            <Ink d={`M410 -6H540`} k={c.at(4, 1.6)} className="stroke cool" />
            <Ink d={`M520 -14l22 8-22 8`} k={c.at(4, 1.8)} className="stroke cool" />
            <Fade k={c.at(4, 1.8)}>
              <text x={556} y={0} className="tech" fontSize={15} fill="var(--graphite)">
                container 80
              </text>
            </Fade>
          </g>

          <Fade k={c.at(5)}>
            <text y={330} className="tech" fontSize={14} fill="var(--faint)">
              across the bridge, down the cable, into the container
            </text>
          </Fade>
        </g>
      </g>
    ),
  },

  // 15 ———————————————————————————— the command does not start it
  {
    title: 'Nobody who starts it',
    render: (c) => {
      const stations = [
        ['docker CLI', 'makes an API call', 3],
        ['the daemon', 'images, networks, volumes', 4],
        ['containerd', 'lifecycle, pulls, layers', 6],
      ] as const
      return (
        <g transform={drift(c.p)}>
          <g transform="translate(120 110)">
            <Heading n={15} of={17} title="Nobody who starts it" k={c.at(1)} />
          </g>

          <Fade k={c.at(2)}>
            <text x={150} y={250} className="tech" fontSize={15} fill="var(--graphite)">
              you type one command, and it is handed on three times
            </text>
          </Fade>

          <g transform="translate(160 400)">
            {stations.map(([name, what, beat], i) => {
              const k = c.at(beat as number)
              return (
                <g key={name} transform={`translate(${i * 440} 0)`}>
                  <Ink d={box(0, 0, 340, 150, 4)} k={k} className="stroke" />
                  <Fade k={clamp(k * 1.5 - 0.5)}>
                    <text x={170} y={70} textAnchor="middle" className="title" fontSize={30} fill="var(--ink)">
                      {name}
                    </text>
                    <text x={170} y={104} textAnchor="middle" className="tech" fontSize={12} fill="var(--faint)">
                      {what}
                    </text>
                  </Fade>
                  {i < 2 && (
                    <g>
                      <Ink d={`M340 75H${340 + 78}`} k={c.at((beat as number) + 1)} className="stroke hair" />
                      <Ink d={`M${340 + 58} 65l22 10-22 10`} k={c.at((beat as number) + 1, 1.4)} className="stroke hair" />
                    </g>
                  )}
                </g>
              )
            })}
          </g>

          <Fade k={c.at(8)}>
            <text x={W / 2} y={720} textAnchor="middle" className="title" fontSize={48} fill="var(--hot)">
              and even containerd does not create the process
            </text>
          </Fade>
        </g>
      )
    },
  },

  // 16 ———————————————————————————— runc builds it and walks away
  {
    title: 'Built, then abandoned',
    render: (c) => {
      const leaving = ease(c.at(6))
      return (
        <g transform={drift(c.p)}>
          <g transform="translate(120 110)">
            <Heading n={16} of={17} title="Built, then abandoned" k={c.at(1)} />
          </g>

          <g
            transform={`translate(${160 - leaving * 90} 280) `}
            opacity={1 - leaving}
          >
            <Ink d={box(0, 0, 300, 110, 4)} k={c.at(2)} className="stroke" />
            <Fade k={c.at(2, 1.3)}>
              <text x={150} y={68} textAnchor="middle" className="title" fontSize={40} fill="var(--ink)">
                runc
              </text>
            </Fade>
            <Fade k={c.at(2, 1.6)}>
              <text x={150} y={140} textAnchor="middle" className="tech" fontSize={12} fill="var(--faint)">
                its only job is to talk to the kernel
              </text>
            </Fade>
          </g>

          <g transform="translate(560 250)">
            {[
              'sets up the namespaces',
              'configures the cgroups',
              'unpacks the root file system',
              'starts the process',
            ].map((step, i) => {
              const k = c.at(4, 1 + i * 0.28)
              return (
                <g key={step} transform={`translate(0 ${i * 70})`}>
                  <Ink d={`M0 0h22v22H0Z`} k={k} className="stroke hair" />
                  <Ink d={`M4 11l6 7 12-15`} k={clamp(k * 1.6 - 0.6)} className="stroke good" />
                  <Fade k={clamp(k * 1.4 - 0.4)}>
                    <text x={42} y={18} className="tech" fontSize={16} fill="var(--graphite)">
                      {step}
                    </text>
                  </Fade>
                </g>
              )
            })}
            <Fade k={c.at(5)}>
              <text y={330} className="tech" fontSize={14} fill="var(--hot)">
                and the moment the process is running, runc terminates
              </text>
            </Fade>
          </g>

          {/* Every process needs a parent. */}
          <g transform="translate(180 560)">
            <Fade k={c.at(7)}>
              <text className="tech" fontSize={15} fill="var(--ink)">
                but on Linux every process needs a parent
              </text>
            </Fade>
            <g transform={`translate(${mix(-160, 40, ease(c.at(8)))} 60)`} opacity={ease(c.at(8))}>
              <Ink d={box(0, 0, 260, 96, 4)} k={c.at(8)} className="stroke cool" />
              <Fade k={c.at(8, 1.4)}>
                <text x={130} y={58} textAnchor="middle" className="title" fontSize={32} fill="var(--cool)">
                  the shim
                </text>
              </Fade>
            </g>
            <Fade k={c.at(9)}>
              <text x={340} y={100} className="tech" fontSize={13} fill="var(--graphite)">
                adopts the container and stays for its whole life
              </text>
              <text x={340} y={126} className="tech" fontSize={13} fill="var(--faint)">
                it keeps the process alive even if containerd restarts
              </text>
            </Fade>
            <Fade k={c.at(10)}>
              <text x={340} y={168} className="tech" fontSize={13} fill="var(--faint)">
                and grabs the exit code when it finally stops
              </text>
            </Fade>
          </g>
        </g>
      )
    },
  },

  // 17 ———————————————————————————— what a container is
  {
    title: 'Nothing but a process',
    render: (c) => {
      const parts = [
        ['namespaces', 'isolate what it can see', 'hot', 3],
        ['cgroups', 'restrict what it can consume', 'amber', 4],
        ['overlayfs', 'stacks its file system', 'cool', 5],
        ['a bridge', 'wires it to the network', 'good', 5],
      ] as const
      return (
        <g transform={drift(c.p, 6, 4)}>
          <g transform="translate(120 110)">
            <Heading n={17} of={17} title="Nothing but a process" k={c.at(1)} />
          </g>

          <g transform="translate(150 330)">
            <Fade k={c.at(2)}>
              <text className="title" fontSize={86} fill="var(--ink)">
                a regular
              </text>
              <text y={92} className="title" fontSize={86} fill="var(--ink)">
                Linux process
              </text>
            </Fade>
            <Fade k={c.at(2, 1.4)}>
              <text y={150} className="tech" fontSize={14} fill="var(--faint)">
                everything else is the kernel telling it a story
              </text>
            </Fade>
          </g>

          <g transform="translate(880 300)">
            {parts.map(([name, what, tone, beat], i) => {
              const k = c.at(beat as number, 1 + (i % 2) * 0.3)
              return (
                <g key={name} transform={`translate(0 ${i * 104})`}>
                  <Ink d={`M0 0H${mix(0, 560, ease(k))}`} k={1} className={`stroke hair ${tone}`} />
                  <Fade k={k}>
                    <text x={0} y={38} className="tech" fontSize={22} fill={`var(--${tone})`}>
                      {name}
                    </text>
                    <text x={230} y={38} className="tech" fontSize={14} fill="var(--graphite)">
                      {what}
                    </text>
                  </Fade>
                </g>
              )
            })}
          </g>

          <g transform="translate(150 700)">
            <Fade k={c.at(5, 1.6)}>
              <Crate k={c.at(5, 1.6)} w={190} h={120} tone="hot" />
            </Fade>
          </g>
        </g>
      )
    },
  },
]

export { W as PLATE_W, H as PLATE_H, rect }
