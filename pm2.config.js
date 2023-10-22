module.exports = {
	name: "thai-law-telegram-bot", // Name of your application
	script: "src/index.ts", // Entry point of your application
	interpreter: "~/.bun/bin/bun", // Path to the Bun interpreter
    watch: '.',
 	output: '/var/log/projects/thai-law-telegram-bot.log'
};
