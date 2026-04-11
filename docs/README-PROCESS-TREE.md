# Copilot Process Tree: Argus vs Direct Launch

## Process Trees

### Launched via Argus

```
[29700] WindowsTerminal.exe
+-- [78536] pwsh.exe
  +-- [88588] node.exe          (Argus backend server)
    +-- [82236] cmd.exe         (PTY host - spawned by node-pty on Windows)
      +-- [25068] node.exe      (node-pty conhost bridge)
        +-- [1316] node.exe     (Copilot agent runner)
          +-- [35316] powershell.exe  (shell session managed by Argus)
            +-- [53900] node.exe      (Copilot language service)
              +-- [36468] copilot.exe
                +-- [38016] copilot.exe
```

Depth: 10 levels (root to leaf)

### Launched via test-pty-copilot.mjs directly

```
[29700] WindowsTerminal.exe
+-- [97352] pwsh.exe
  +-- [67464] node.exe          (test script process)
    +-- [71840] powershell.exe  (shell session)
      +-- [29212] node.exe      (Copilot language service)
        +-- [81632] copilot.exe
          +-- [98156] copilot.exe
```

Depth: 7 levels (root to leaf)

## Key Differences

| Layer | Argus launch | Direct launch |
|---|---|---|
| Shell host | `pwsh` | `pwsh` |
| Node entry point | Argus backend server | test script directly |
| PTY intermediary | `cmd.exe` + 2x node bridges | absent |
| Shell session | `powershell.exe` (PTY-managed) | `powershell.exe` |
| Copilot runner | `node.exe` | `node.exe` |
| Copilot processes | 2x `copilot.exe` | 2x `copilot.exe` |

## Why Argus Has Extra Depth

Argus adds three extra layers compared to the direct test script:

**1. Argus backend (`node.exe` [88588])**
The Argus server is itself a Node process. When it spawns a Copilot session, the chain starts one level deeper than a standalone script.

**2. `cmd.exe` PTY host ([82236])**
On Windows, `node-pty` does not spawn processes directly. It uses a `cmd.exe` or `conhost.exe` intermediary to host the pseudo-terminal. This is a Windows PTY implementation detail that does not appear in the direct launch because the direct script may use a simpler spawn mechanism (e.g., `child_process.spawn` without a full PTY).

**3. Two extra `node.exe` bridge processes ([25068], [1316])**
These are likely `node-pty`'s internal architecture: one process acts as the PTY conhost bridge and another as the agent process that manages the shell session lifecycle. The direct script collapses this into a single node process because it invokes the Copilot runner directly without a PTY session layer.

## Implication for Process Detection

When Argus needs to identify or signal a Copilot process it launched, it cannot rely on the process being a direct child or grandchild of the Argus node process. It must walk the tree. The `show-parent-tree.ps1` script in `scripts/` can help verify the chain at runtime.
