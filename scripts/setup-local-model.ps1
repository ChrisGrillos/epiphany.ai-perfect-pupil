param([ValidateSet('qwen3-4b', 'qwen3.5-2b')][string]$Model = 'qwen3-4b')
$ErrorActionPreference = 'Stop'
$ppRoot = Join-Path $env:LOCALAPPDATA 'PerfectPupil\local-model'
$ppDownloads = Join-Path $ppRoot 'downloads'
$ppBin = Join-Path $ppRoot 'llama-b11712-cuda12'
$ppModels = Join-Path $ppRoot 'models'
$ppPrevious = if (Test-Path -LiteralPath (Join-Path $ppRoot 'installation.json')) { Get-Content -LiteralPath (Join-Path $ppRoot 'installation.json') -Raw | ConvertFrom-Json } else { $null }
New-Item -ItemType Directory -Force -Path $ppDownloads, $ppBin, $ppModels | Out-Null

function Get-PupilSha256($Path) {
    $ppStream = [IO.File]::OpenRead($Path)
    $ppAlgorithm = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($ppAlgorithm.ComputeHash($ppStream)).Replace('-', '').ToLowerInvariant() }
    finally { $ppAlgorithm.Dispose(); $ppStream.Dispose() }
}

function Expand-PupilArchive($Path, $Destination) {
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $ppArchive = [IO.Compression.ZipFile]::OpenRead($Path)
    $ppResolvedRoot = [IO.Path]::GetFullPath($Destination).TrimEnd('\') + '\'
    try {
        foreach ($ppEntry in $ppArchive.Entries) {
            $ppTarget = [IO.Path]::GetFullPath([IO.Path]::Combine($ppResolvedRoot, $ppEntry.FullName))
            if (-not $ppTarget.StartsWith($ppResolvedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive entry escapes the runtime folder' }
            if (-not $ppEntry.Name) { [IO.Directory]::CreateDirectory($ppTarget) | Out-Null; continue }
            [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($ppTarget)) | Out-Null
            [IO.Compression.ZipFileExtensions]::ExtractToFile($ppEntry, $ppTarget, $true)
        }
    } finally { $ppArchive.Dispose() }
}

function Get-VerifiedPupilAsset($Url, $Destination, $Hash) {
    if ((Test-Path -LiteralPath $Destination) -and ((Get-PupilSha256 $Destination) -eq $Hash)) {
        Write-Output "Verified cached asset: $([IO.Path]::GetFileName($Destination))"
        return
    }
    $ppPartial = "$Destination.part"
    & curl.exe --fail --location --retry 3 --continue-at - --output $ppPartial $Url
    if ($LASTEXITCODE -ne 0) { throw "Download failed: $Url" }
    if ((Get-PupilSha256 $ppPartial) -ne $Hash) { throw "SHA-256 mismatch: $ppPartial" }
    Move-Item -LiteralPath $ppPartial -Destination $Destination -Force
}

$ppRuntimeUrl = 'https://github.com/ggml-org/llama.cpp/releases/download/b11712/llama-b11712-bin-win-cuda-12.4-x64.zip'
$ppCudaUrl = 'https://github.com/ggml-org/llama.cpp/releases/download/b11712/cudart-llama-bin-win-cuda-12.4-x64.zip'
$ppChoice = if ($Model -eq 'qwen3-4b') {
    @{ File = 'Qwen3-4B-Instruct-2507-Q4_K_M.gguf'; Source = 'lmstudio-community/Qwen3-4B-Instruct-2507-GGUF'; Revision = '4edb920b6f14e3b9284d4502a6485103d72cde05'; Hash = '8cdb57cbb880d313736a9bc4e3d3d2485f145b5e19cf33783746e753e82641fc'; Id = 'perfect-pupil-qwen3-4b-instruct-q4_k_m' }
} else {
    @{ File = 'Qwen3.5-2B-Q4_K_M.gguf'; Source = 'lmstudio-community/Qwen3.5-2B-GGUF'; Revision = 'bb84e11355a036e28f080c7793fa6d22b7c4e344'; Hash = '0bfe35afc9f05b7fac3fa04925e051ac7939a42a8a17ea11afc99701bea826cc'; Id = 'perfect-pupil-qwen3.5-2b-q4_k_m' }
}
$ppModelUrl = "https://huggingface.co/$($ppChoice.Source)/resolve/$($ppChoice.Revision)/$($ppChoice.File)"
$ppRuntimeZip = Join-Path $ppDownloads 'llama-b11712-cuda12.zip'
$ppCudaZip = Join-Path $ppDownloads 'cudart-cuda12.zip'
$ppModelFile = Join-Path $ppModels $ppChoice.File
Get-VerifiedPupilAsset $ppRuntimeUrl $ppRuntimeZip '18e1cbc882a118cdf411527e5eb18c3a2b6436d27651540cfbb3e3b82a3560fc'
Get-VerifiedPupilAsset $ppCudaUrl $ppCudaZip '8c79a9b226de4b3cacfd1f83d24f962d0773be79f1e7b75c6af4ded7e32ae1d6'
if (-not (Test-Path (Join-Path $ppBin 'llama-server.exe'))) { Expand-PupilArchive $ppRuntimeZip $ppBin }
if (-not (Test-Path (Join-Path $ppBin 'cublas64_12.dll'))) { Expand-PupilArchive $ppCudaZip $ppBin }
Get-VerifiedPupilAsset $ppModelUrl $ppModelFile $ppChoice.Hash
$ppServer = Get-ChildItem -LiteralPath $ppBin -Filter llama-server.exe -Recurse | Select-Object -First 1 -ExpandProperty FullName
if (-not $ppServer) { throw 'Verified runtime archive has no llama-server.exe' }
$ppManifest = [ordered]@{
    format = 'perfect-pupil-local-model-v1'
    installed_at = [DateTime]::UtcNow.ToString('o')
    runtime = 'llama.cpp-b11712-cuda12.4'
    executable = $ppServer
    model_path = $ppModelFile
    model_id = $ppChoice.Id
    source = $ppChoice.Source
    revision = $ppChoice.Revision
    sha256 = $ppChoice.Hash
    endpoint = 'http://127.0.0.1:8080/v1'
    context_tokens = 4096
    gpu_layers = 99
    parallel = 1
    batch = 128
    ubatch = 128
    auto_start = $true
}
if ($ppPrevious -and $ppPrevious.protected_api_key) { $ppManifest.protected_api_key = $ppPrevious.protected_api_key }
$ppManifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $ppRoot 'installation.json') -Encoding utf8
$ppManifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $ppRoot "installation-$Model.json") -Encoding utf8
Write-Output "Local model installed and verified: $ppModelFile"
