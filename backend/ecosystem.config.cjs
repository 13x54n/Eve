module.exports = {
  apps: [
    {
      name: "server",
      cwd: __dirname,
      script: "./node_modules/.bin/tsx",
      args: "gateway/src/server.ts",
    },
  ],
};
