// Блокирует чтение и запись секретов и разрушительный git.
// Вход: JSON хука Cursor на stdin. Выход: permission allow|deny.
// Пример: node ./hooks/block-secrets.js < event.json

const SECRET_OK = /\.env\.(example|sample|template|dist)(\b|$)/i;

function stringsFrom(input) {
  const out = [];
  const push = (value) => {
    if (typeof value === "string" && value.trim()) out.push(value);
  };
  push(input.file_path);
  push(input.path);
  push(input.filePath);
  push(input.command);
  const toolInput = input.tool_input || input.toolInput || {};
  if (toolInput && typeof toolInput === "object") {
    push(toolInput.file_path);
    push(toolInput.path);
    push(toolInput.filePath);
    push(toolInput.target_file);
    push(toolInput.command);
  }
  if (Array.isArray(input.edits)) {
    for (const edit of input.edits) {
      if (edit && typeof edit === "object") push(edit.file_path || edit.path);
    }
  }
  return out;
}

function isSecretPath(value) {
  const text = String(value).replace(/\\/g, "/");
  if (SECRET_OK.test(text)) return false;
  if (/(^|\/)\.env(\.|$)/i.test(text)) return true;
  if (/(^|\/)(credentials|secrets?)\.(json|yml|yaml|txt)$/i.test(text)) return true;
  if (/(^|\/)id_rsa$/i.test(text)) return true;
  return false;
}

function commandTouchesSecret(value) {
  const text = String(value).replace(/\\/g, "/");
  if (isSecretPath(text)) return true;
  const withoutSamples = text.replace(/\.env\.(example|sample|template|dist)/gi, "");
  if (/(^|[\s"'`=])\.env(\s|$|["'`])/i.test(withoutSamples)) return true;
  if (/\.env\.(local|production|development)\b/i.test(text)) return true;
  return false;
}

function isDestructiveGit(value) {
  const text = String(value).toLowerCase();
  if (!/\bgit\b/.test(text)) return false;
  if (/\bpush\b/.test(text) && /(^|\s)(-f|--force-with-lease|--force)(\s|$)/.test(text)) return true;
  if (/\breset\b/.test(text) && /--hard\b/.test(text)) return true;
  return false;
}

function decide(parts) {
  for (const part of parts) {
    if (isSecretPath(part) || commandTouchesSecret(part)) {
      return "Заблокировано: секретный файл (.env и аналоги). Можно читать .env.example. Значения секретов добавляй вручную.";
    }
    if (isDestructiveGit(part)) {
      return "Заблокировано: force-push и git reset --hard. Эти команды запускай сам в терминале, если они правда нужны.";
    }
  }
  return "";
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  let input = {};
  try {
    input = JSON.parse(raw || "{}");
  } catch {
    input = {};
  }
  const reason = decide(stringsFrom(input));
  if (reason) {
    process.stdout.write(
      JSON.stringify({
        permission: "deny",
        user_message: reason,
        agent_message: reason,
      }),
    );
    return;
  }
  process.stdout.write(JSON.stringify({ permission: "allow" }));
});
