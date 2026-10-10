# Tableu plugin 0.28.2: files to apply

> **Superseded.** `SKILL.md` and `references/actions-contract.md` here are now
> the 0.29.0 instructions, identical to the copies in the locked
> [1.0.3 package](../submission/1.0.3/README.md). Release by building and
> uploading a locked submission package
> ([public listing runbook](../public-listing.md)), not by editing a package
> by hand. The steps below are the historical 0.28.2 install; don't use them to
> publish these files under an old version.

These files carry the Tableu ChatGPT plugin's instructions for the live MCP
tools. The rest of the package, including its reference guides and assets, is
not stored in this public repository.

0.28.2 matches the server changes of 2026-09-29: jobId is the only job
reference, saves come only from the job within 24 hours, and a status without
`reading` is a support message or a withheld reading. To update an installed
0.28.x package, replace the two files in steps 2 and 3, set `version` to
`0.28.2` in both manifests, and repeat step 6. 0.28.1 was edited outside this
repository; merge any of its changes that these files lack before uploading.

For a first install from 0.27.3, follow every step:

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
   - set `version` to `0.28.2`;
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
