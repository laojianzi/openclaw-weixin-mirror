import type { OpenClawConfig } from "openclaw/plugin-sdk/core";

/** Minimal subset of commander's Command used by registerWeixinCli. */
type CliCommand = {
  command(name: string): CliCommand;
  description(str: string): CliCommand;
  option(flags: string, description: string): CliCommand;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action(fn: (...args: any[]) => void | Promise<void>): CliCommand;
};

/** Register the `openclaw openclaw-weixin` CLI subcommands. */
export function registerWeixinCli(params: { program: CliCommand; config: OpenClawConfig }): void {
  const { program } = params;

  const root = program.command("openclaw-weixin").description("Weixin channel utilities");

  root
    .command("uninstall")
    .description("Uninstall the Weixin plugin (cleans up channel config automatically)")
    .action(async () => {
      const { loadConfig, writeConfigFile } = await import("openclaw/plugin-sdk/config-runtime");
      const cfg = loadConfig();
      const channels = (cfg.channels ?? {}) as Record<string, unknown>;
      if (channels["openclaw-weixin"]) {
        delete channels["openclaw-weixin"];
        await writeConfigFile({ ...cfg, channels });
        console.log("[weixin] Cleaned up channel config.");
      }
      const { execSync } = await import("node:child_process");
      try {
        execSync("openclaw plugins uninstall openclaw-weixin", { stdio: "inherit" });
      } catch {
        // uninstall command handles its own error output
      }
    });
}
