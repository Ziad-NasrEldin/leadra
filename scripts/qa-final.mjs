import { spawn } from 'node:child_process'

const commands = [
  ['npm', ['run', 'lint']],
  ['npx', ['tsc', '-b', '--pretty', 'false']],
  ['npm', ['run', 'test']],
  ['npm', ['run', 'build']],
  ['npm', ['run', 'qa:preview']],
]

if (process.env.LEADRA_QA_ALLOW_DESTRUCTIVE === 'true') {
  commands.push(['npm', ['run', 'qa:staging']])
} else {
  console.log('Skipping staging destructive QA. Set LEADRA_QA_ALLOW_DESTRUCTIVE=true and staging env vars to enable it.')
}

for (const [command, args] of commands) {
  await run(command, args)
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${command} ${args.join(' ')}`)
    const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`))
    })
  })
}
