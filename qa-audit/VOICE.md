# Voice caller — sonnet, one call scenario at a time

The local voice stack of `tools/local-voice/README.md`: Kamailio on
`127.0.0.1:5060` tags every call with the voice organization, Whisper and
Kokoro on speaches (`localhost:8000`), Ollama answers. No headset at night:
the caller is a WAV file, the agent's voice is recorded and transcribed.

## Harness

- **Caller audio** — each line the caller says, synthesized once:
  `curl -s localhost:8000/v1/audio/speech -H 'content-type: application/json'
  -d '{"model":"speaches-ai/Kokoro-82M-v1.0-ONNX","voice":"ff_siwis","input":"<line>","response_format":"wav"}'
  -o turn-<k>.wav`.
- **The call** — baresip with its own config dir `<run-dir>/voice/baresip/`:
  `config` with `module_path /opt/homebrew/lib/baresip/modules`, then
  `module` lines for `stdio.so`, `menu.so`, `g711.so`, `aufile.so`,
  `ctrl_tcp.so`, `ctrl_tcp_listen 127.0.0.1:<4444 + slot>`,
  `sip_listen 127.0.0.1:<5070 + slot>`, `audio_source aufile,<turn-1.wav>`,
  `audio_player aufile,<call-n-agent.wav>`; `accounts` with
  `<sip:local@127.0.0.1>;regint=0`. Launch `baresip -f <dir> -e
  "/dial sip:test@127.0.0.1:5060" -t <seconds>` in the background.
- **Next turn** — when the agent has finished speaking (the recorded file
  stops growing for 2 s), switch the source over ctrl_tcp:
  `/ausrc aufile,<turn-k.wav>`; `/hangup` to end as the caller.
- **The agent's words** — transcribe `call-n-agent.wav` with
  `curl -s localhost:8000/v1/audio/transcriptions -F file=@… -F
  model=Systran/faster-whisper-small -F language=fr`.
- **Independent read** — the conversation in the console (list, detail,
  transcript, summary) and `select … from conversations where
  organization_id = '<voice org>' order by created_at desc limit 1`.

**Harness smoke first**: one call saying « Bonjour », agent audio recorded and
non-empty, its transcript holding the agent's first sentence. A smoke that
fails on the harness (ctrl_tcp source switch refused, empty recording) →
fall back to ONE pre-mixed WAV per call (every turn separated by 12 s of
silence, joined with `ffmpeg -f concat`) and say so in the
results. A smoke that fails on the stack → `ENV-BLOCK <reason>`.

## Setup charter (first, once)

From the console as the owner of the voice organization: create a channel
**SIP Trunk (agnostique)** with Identité SIP `test` on its agent, then prove
it by the smoke call. This creation is itself rows of the charter.

## Scenarios the Planner draws from

- Happy: a caller books or asks what the agent's prompt covers, hangs up
  politely; the conversation lands in the console with a correct transcript
  and summary.
- Silence: the caller says nothing for 30 s.
- Barge-in: the caller talks over the agent's first sentence.
- Noise: a turn of 10 s of unintelligible speech.
- Long: a 4-minute call of six turns.
- Hang-up mid-sentence by the caller; the conversation still closes.
- Agent edited in the console between two calls (first sentence, prompt): the
  next call uses the new values.
- Two calls at once (the maximum): both land, neither mixes the other's turns.

## Prompt template

> You are a phone caller testing a voice agent. Read
> `~/.claude/skills/qa-audit/VOICE.md` (harness) and
> `~/.claude/skills/qa/SKILL.md` (evidence rules).
> CHARTER: {{charter path}}. STACK: {{stack.md path}} (voice section).
> VOICE ORGANIZATION: {{id}}. CALL SLOT: {{1 or 2}} — your ctrl_tcp port is
> 4444 + slot, your SIP port 5070 + slot, your baresip dir
> `voice/baresip-<slot>/`.
> EVIDENCE: {{run-dir}}/evidence/, files `voice-<scenario>-*` (caller WAVs,
> agent recording, agent transcript, console screenshot, SQL row).
> ORACLE: `~/.claude/skills/qa-audit/SKILL.md` § Oracle, rule 6 for the
> call itself.
> Return `{{run-dir}}/results/voice-<slot>.md` in the `EXECUTOR.md` format,
> one line at the end: `DONE <pass>/<fail>/<blocked> <results path>`.
