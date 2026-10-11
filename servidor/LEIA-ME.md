# Danni's Tur · como ligar o servidor da renovação 2027

O servidor é uma planilha Google com um script. Ele guarda os cadastros, entrega o contrato de cada família por um link próprio, deixa você colocar o valor e liberar, recebe o contrato assinado e te avisa no WhatsApp.

Use a conta **dannistur@gmail.com** (separada do Galera da Raquete).

## 1. Planilha e script (uns 10 minutos)

1. Entre em **sheets.google.com** com a dannistur@gmail.com e crie uma planilha em branco. Nome: **Danni's Tur – Renovações 2027**.
2. Menu **Extensões › Apps Script**.
3. Apague o que estiver escrito e cole todo o conteúdo do arquivo **Codigo.gs**. Salve (ícone de disquete).
4. No alto, escolha a função **configurar** e clique em **Executar**. O Google vai pedir autorização: clique em *Revisar permissões*, escolha a conta, *Avançado*, *Acessar (não seguro)* e *Permitir*. (O aviso aparece porque o script é seu e não foi publicado na loja do Google.)
5. Engrenagem **Configurações do projeto** › **Propriedades do script** › edite:
   - `SENHA_ADMIN`: troque `TROQUE-ESTA-SENHA` pela senha da Área Danni's.
   - `CALLMEBOT_CHAVE`: a chave do passo 2 abaixo.
6. **Implantar › Nova implantação** › tipo **App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
   - Clique em **Implantar** e copie a **URL do app da Web** (termina em `/exec`). Mande essa URL pro Claude.

## 2. Avisos no seu WhatsApp (CallMeBot, grátis)

1. No celular do número **19 99778-1210**, salve o contato **+34 644 91 07 79**.
2. Mande pelo WhatsApp: `I allow callmebot to send me messages`
3. Você recebe uma chave (apikey). Coloque em `CALLMEBOT_CHAVE` (passo 1.5).
4. Na Área Danni's, toque em **Testar aviso no meu WhatsApp**.

Você vai receber aviso de: nova renovação, contrato assinado, família que vai entregar impresso e aniversariantes (todo dia às 7h, os de hoje e de amanhã). Cópia de tudo vai pro e-mail da conta.

## O que fica onde

- **Planilha › aba Renovações**: um cadastro por linha. Pode olhar, mas evite editar à mão as colunas `id`, `token` e `alunos_json`.
- **Drive › pasta "Danni's Tur – Contratos assinados"**: os PDFs que os pais enviam.

## Se precisar mudar o script depois

Cole o código novo, salve e vá em **Implantar › Gerenciar implantações › editar (lápis) › Versão: Nova versão › Implantar**. A URL continua a mesma.
