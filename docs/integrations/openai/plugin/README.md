# Tableu plugin 0.28.0: files to apply

These files update the Tableu ChatGPT plugin (0.27.3, downloaded from ChatGPT)
so that it uses the live MCP tools. The rest of the package, including its
reference guides and assets, is not stored in this public repository.

1. Unzip the 0.27.3 package.
2. Replace `skills/instructions/SKILL.md` with [SKILL.md](SKILL.md).
3. Replace `skills/instructions/references/actions-contract.md` with
   [references/actions-contract.md](references/actions-contract.md).
4. Copy [.app.json.template](.app.json.template) to the package root as
   `.app.json`, and set `id` to the registered app's id: the `plugin_asdk_app_…`
   value from the ChatGPT URL, without the leading `plugin_`. Validation
   requires ids that start with `asdk_app_`. If validation rejects the id,
   ask `@plugin-creator` in ChatGPT to write the mapping for that app id.
5. Update both manifests, `plugin.json` and `.codex-plugin/plugin.json`:
   - set `version` to `0.28.0`;
   - reference the app mapping: `"apps": "./.app.json"` under
     `extensions.com.openai` in `plugin.json`, and top-level `"apps": "./.app.json"`
     in `.codex-plugin/plugin.json`;
   - set each manifest's root `description` to "Tarot readings drawn
     and interpreted by Tableu, saved to your Tableu journal with your
     reflections.";
   - in `plugin.json`, put `interface` under `extensions.com.openai`; set
     `interface.longDescription` to the same description and
     `interface.capabilities` to `["Read", "Write"]`;
   - in `.codex-plugin/plugin.json`, set the same fields under its top-level
     `interface` object.
   When `extensions.com.openai` is an object, it supplies all OpenAI settings:
   `.codex-plugin/plugin.json` is ignored, not merged. Keep any required
   presentation fields and app mappings in that inline object. See
   [OpenAI's packaging guidance](https://developers.openai.com/plugins/build/plugins#add-openai-specific-metadata).
6. Zip the package and upload it in ChatGPT Plugins (developer mode). Start a
   new chat to test.
