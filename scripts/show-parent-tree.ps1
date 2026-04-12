param([string]$ProcessName)

$ProcessName = $ProcessName -replace '\.exe$', ''
$processes = Get-Process -Name $ProcessName -ErrorAction Stop

function Get-Ancestors([int]$startPid) {
    $chain = [System.Collections.Generic.List[object]]::new()
    $currentPid = $startPid
    while ($currentPid -ne 0) {
        $p = Get-CimInstance Win32_Process -Filter "ProcessId = $currentPid"
        if (-not $p) { break }
        $chain.Add($p)
        $currentPid = $p.ParentProcessId
    }
    $chain.Reverse()
    return ,$chain
}

foreach ($proc in $processes) {
    $chain = Get-Ancestors $proc.Id
    Write-Host ""
    for ($i = 0; $i -lt $chain.Count; $i++) {
        $p = $chain[$i]
        $cmd = if ($p.CommandLine) { $p.CommandLine.Trim() } else { "(no command line)" }
        if ($i -eq 0) {
            Write-Host "[$($p.ProcessId)] $($p.Name)"
            Write-Host "    cmd: $cmd"
        } else {
            $indent = "  " * ($i - 1)
            Write-Host "$indent+-- [$($p.ProcessId)] $($p.Name)"
            Write-Host "$indent    cmd: $cmd"
        }
    }
}
