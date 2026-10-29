# Minhas finanças

Aplicativo desktop para controle financeiro pessoal. A interface usa React e TypeScript, e os lançamentos ficam em um banco SQLite local no computador por meio do Tauri. Não há servidor de aplicação, sincronização em nuvem ou IndexedDB.

## Versões

O número da versão é mantido em `package.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` e `src-tauri/tauri.conf.json`; mantenha esses valores sincronizados. O Vite obtém a versão do `package.json` e a exibe no canto inferior direito do app. A versão também define o nome dos instaladores.

Seguimos o formato `MAJOR.MINOR.PATCH`: aumente `PATCH` para correções e ajustes pequenos, `MINOR` para funcionalidades compatíveis e `MAJOR` para mudanças incompatíveis. Como o app ainda está na série `0.x`, a versão `0.3.0` identifica a inclusão das configurações de aparência e do seletor de tema.

## Requisitos

- Node.js LTS e npm
- Rust com a toolchain estável
- Dependências de sistema do Tauri 2 para a plataforma usada

No Windows, instale o Visual Studio 2022 Build Tools com a carga **Desenvolvimento para desktop com C++**, incluindo o MSVC v143 (x64/x86) e um Windows 10/11 SDK. Esses componentes fornecem o `link.exe` exigido para compilar o alvo Rust MSVC. Instale também o WebView2 Runtime.
Consulte [requirements.txt](./requirements.txt) para a lista de pré-requisitos e comandos no Windows.

## Desenvolvimento

```powershell
npm.cmd install
npm.cmd run tauri dev
```

No PowerShell, use `npm.cmd` se a política de execução bloquear `npm.ps1`. Isso evita alterar as configurações de segurança do sistema.

Se o Rust informar `linker link.exe not found`, abra o **Developer PowerShell for VS 2022** (ou o **x64 Native Tools Command Prompt for VS 2022**) e execute os comandos de desenvolvimento nesse terminal. Verifique primeiro se `where.exe link.exe` encontra o linker. Se não encontrar, abra o Visual Studio Installer, modifique a instalação do Build Tools e confira a carga e os componentes C++ acima. O VS Code, sozinho, não inclui o compilador nem o linker.

O comando abre o aplicativo desktop e inicia o Vite como servidor de desenvolvimento local temporário. Esse servidor só atende a interface enquanto o modo de desenvolvimento está aberto; não é necessário hospedar nem administrar um servidor.

## Gerar aplicativo

```powershell
npm.cmd run tauri build
```

O instalador/artefato da plataforma será gerado em `src-tauri/target/release/bundle`.

## Armazenamento

Na primeira execução, o aplicativo cria `financas.db` na pasta de dados local do aplicativo gerenciada pelo Tauri. Os valores monetários são armazenados em centavos inteiros para evitar imprecisão de ponto flutuante. Faça cópias de segurança desse arquivo para preservar seus dados.
