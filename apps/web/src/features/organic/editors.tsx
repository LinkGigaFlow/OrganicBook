import type { Block, Center, Note, OrganicPage } from '@cuaderno/shared';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DrawCanvas } from '../../components/draw/DrawCanvas';
import { IconImage, IconMic, IconUpload } from '../../components/ui/icons';
import { toast } from '../../components/ui/toast-store';
import { files, useFileUrl } from '../../lib/files';
import { sanitizeInline } from '../../lib/html';
import { BlockEditor, type BlockEditorHandle } from '../pages/editor/BlockEditor';
import { formatDuration, MAX_AUDIO_BYTES, saveRecording, useRecorder } from '../voice/recorder';
import { type Dictation, startDictation, speechSupported } from '../voice/speech';
import { useAppStore } from '../../app/store';
import { dimmedBg } from './look';

/** Pide una imagen al usuario, la reduce y la guarda; entrega su `fileId`. */
export type PickImage = (done: (fileId: string) => void) => void;

/* ------------------------------------------------------------------ */
/* Texto editable simple (centro, pies de imagen)                       */
/* ------------------------------------------------------------------ */

function Editable({
  html,
  onChange,
  className,
  placeholder,
  label,
  style,
}: {
  html: string;
  onChange: (html: string) => void;
  className: string;
  placeholder: string;
  label: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Solo se escribe desde el modelo al montar o si cambia desde fuera (no mueve el cursor).
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== html) el.innerHTML = html;
  }, [html]);
  return (
    <div
      ref={ref}
      className={className}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      aria-multiline="true"
      data-ph={placeholder}
      style={style}
      onInput={(e) => {
        const el = e.currentTarget;
        if (el.innerHTML === '<br>') el.innerHTML = '';
        onChange(sanitizeInline(el.innerHTML));
      }}
    />
  );
}

function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={'seg' + (className ? ' ' + className : '')}
      role="radiogroup"
      aria-label={label}
    >
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          className={value === v ? 'on' : ''}
          onClick={() => onChange(v)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Centro                                                              */
/* ------------------------------------------------------------------ */

export function CenterEditor({
  page,
  onChange,
  pickImage,
}: {
  page: OrganicPage;
  onChange: (patch: Partial<Center>) => void;
  pickImage: PickImage;
}) {
  const c = page.center;
  const bgUrl = useFileUrl(c.mode !== 'image' ? c.bgFileId : undefined).url;
  const bg = bgUrl ? dimmedBg(bgUrl, c.bgDim) : undefined;

  return (
    <div className="center-ed">
      <Seg
        className="rmode"
        label="Modo del centro"
        value={c.mode}
        options={[
          ['text', 'Texto'],
          ['draw', 'Lápiz'],
          ['image', 'Imagen'],
        ]}
        onChange={(mode) => onChange({ mode })}
      />
      {c.mode !== 'image' ? (
        <div className="bgpanel">
          <div className="vlab">Imagen de fondo de la hoja</div>
          <div className="rrow">
            <button
              type="button"
              className="btn"
              onClick={() => pickImage((bgFileId) => onChange({ bgFileId }))}
            >
              {c.bgFileId ? 'Cambiar imagen' : 'Elegir imagen'}
            </button>
            {c.bgFileId ? (
              <>
                <button
                  type="button"
                  className="btn"
                  onClick={() => onChange({ bgFileId: undefined })}
                >
                  Quitar
                </button>
                <Seg
                  label="Alcance del fondo"
                  value={c.bgScope}
                  options={[
                    ['hoja', 'Solo la hoja'],
                    ['tablero', 'Todo el tablero'],
                  ]}
                  onChange={(bgScope) => onChange({ bgScope })}
                />
                <label>
                  Oscurecer
                  <input
                    type="range"
                    min={0}
                    max={75}
                    value={Math.round(c.bgDim * 100)}
                    aria-label="Oscurecer imagen"
                    onChange={(e) => onChange({ bgDim: Number(e.target.value) / 100 })}
                  />
                </label>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {c.mode === 'text' ? (
        <Editable
          className={'oedit' + (bg ? ' hasbg' : '')}
          html={c.html}
          label="Tema central"
          placeholder="Escribe el tema central"
          style={bg ? { backgroundImage: bg } : undefined}
          onChange={(html) => onChange({ html })}
        />
      ) : c.mode === 'draw' ? (
        <div className="odraw">
          <DrawCanvas
            strokes={c.strokes}
            h={c.h}
            background={bg}
            onStrokes={(strokes) => onChange({ strokes })}
            onHeight={(h) => onChange({ h })}
          />
        </div>
      ) : (
        <ImageEditor
          fileId={c.fileId}
          cap={c.cap}
          capPlaceholder="Texto de la postal"
          pickImage={pickImage}
          onFile={(fileId) => onChange({ fileId })}
          onCap={(cap) => onChange({ cap })}
          extra={
            <Seg
              label="Cómo se muestra la imagen"
              value={c.imgMode}
              options={[
                ['postal', 'Postal'],
                ['fondo', 'De fondo'],
              ]}
              onChange={(imgMode) => onChange({ imgMode })}
            />
          }
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Imagen                                                              */
/* ------------------------------------------------------------------ */

export function ImageEditor({
  fileId,
  cap,
  capPlaceholder,
  pickImage,
  onFile,
  onCap,
  extra,
}: {
  fileId: string | undefined;
  cap: string;
  capPlaceholder: string;
  pickImage: PickImage;
  onFile: (fileId: string) => void;
  onCap: (cap: string) => void;
  extra?: React.ReactNode;
}) {
  const { url, missing } = useFileUrl(fileId);
  if (!fileId) {
    return (
      <button type="button" className="pickimg" onClick={() => pickImage(onFile)}>
        <IconImage />
        <span>Elegir una imagen</span>
      </button>
    );
  }
  return (
    <>
      <div className="rimg">
        {url ? (
          <img src={url} alt="" />
        ) : missing ? (
          <div className="img-missing">Imagen no disponible en este dispositivo</div>
        ) : null}
      </div>
      <Editable
        className="rcap"
        html={cap}
        label="Descripción de la imagen"
        placeholder={capPlaceholder}
        onChange={onCap}
      />
      <div className="rrow">
        {extra}
        <button type="button" className="btn" onClick={() => pickImage(onFile)}>
          Cambiar imagen
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Nota a lápiz                                                        */
/* ------------------------------------------------------------------ */

export function DrawNoteEditor({
  note,
  onChange,
}: {
  note: Note;
  onChange: (patch: Partial<Note>) => void;
}) {
  return (
    <div className="odraw">
      <DrawCanvas
        strokes={note.strokes ?? []}
        h={note.h ?? 640}
        onStrokes={(strokes) => onChange({ strokes })}
        onHeight={(h) => onChange({ h })}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Nota Markdown: el mismo editor de bloques de las páginas             */
/* ------------------------------------------------------------------ */

export function MdNoteEditor({
  note,
  onBlocks,
  createSubpage,
  openSubpage,
}: {
  note: Note;
  onBlocks: (blocks: Block[]) => void;
  createSubpage: () => Promise<string>;
  openSubpage: (id: string) => void;
}) {
  // Bloques iniciales leídos una sola vez: después manda el editor.
  const [initial] = useState(() => note.blocks ?? []);
  const editor = useRef<BlockEditorHandle>(null);
  // Nota vacía (recién creada): se empieza a escribir de inmediato.
  useEffect(() => {
    const empty = initial.every((b) => b.type === 'p' && !b.html);
    if (empty) editor.current?.focusStart();
  }, [initial]);
  return (
    <div className="mdnote">
      <BlockEditor
        ref={editor}
        initialBlocks={initial}
        onSave={onBlocks}
        createSubpage={createSubpage}
        openSubpage={openSubpage}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Nota de voz                                                         */
/* ------------------------------------------------------------------ */

/** Duración de un audio (0 si el navegador no la conoce). */
function audioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const a = new Audio();
    const done = (d: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? d : 0);
    };
    a.onloadedmetadata = () => done(a.duration);
    a.onerror = () => done(0);
    a.src = url;
  });
}

export function VoiceEditor({
  note,
  onChange,
}: {
  note: Note;
  onChange: (patch: Partial<Note> | ((n: Note) => Partial<Note>)) => void;
}) {
  const lang = useAppStore((s) => s.settings.lang);
  const { state, start, stop } = useRecorder((m) => toast(m));
  const { url } = useFileUrl(note.audioFileId);
  const upload = useRef<HTMLInputElement>(null);
  const transcribing = useRef<Dictation | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const recording = state.status === 'recording';

  // La transcripción en vivo agrega texto al final mientras se graba.
  useEffect(() => () => transcribing.current?.stop(), []);
  useEffect(() => {
    const el = textRef.current;
    if (el && document.activeElement !== el && el.value !== (note.text ?? '')) {
      el.value = note.text ?? '';
    }
  }, [note.text]);

  const toggle = async () => {
    if (recording) {
      transcribing.current?.stop();
      transcribing.current = null;
      const rec = await stop();
      if (!rec) return;
      const audioFileId = await saveRecording(rec);
      onChange({ audioFileId, dur: rec.dur });
      return;
    }
    await start();
    if (!speechSupported()) return;
    transcribing.current = startDictation(lang, {
      onInterim: () => {},
      onFinal: (t) => onChange((n) => ({ text: n.text ? `${n.text} ${t}` : t })),
      onError: (m, fatal) => fatal && toast(m),
      onEnd: () => {
        transcribing.current = null;
      },
    });
  };

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_AUDIO_BYTES) {
      toast('El audio supera 15 MB');
      return;
    }
    if (!file.type.startsWith('audio/')) {
      toast('Ese archivo no es un audio');
      return;
    }
    const dur = await audioDuration(file);
    const audioFileId = await files.put(file);
    onChange({ audioFileId, dur });
  };

  const status =
    state.status === 'recording'
      ? `Grabando ${formatDuration(state.elapsed)} · toca para detener`
      : state.status === 'starting'
        ? 'Abriendo el micrófono…'
        : note.audioFileId
          ? 'Toca para grabar de nuevo (reemplaza el audio)'
          : speechSupported()
            ? 'Toca para grabar; se transcribe mientras hablas'
            : 'Toca para grabar (la transcripción se escribe a mano en este navegador)';

  return (
    <div className="voice-ed">
      <button
        type="button"
        className={'vrec' + (recording ? ' on' : '')}
        aria-label={recording ? 'Detener grabación' : 'Grabar'}
        aria-pressed={recording}
        onClick={() => void toggle()}
      >
        <IconMic />
      </button>
      <div className="vstat2" aria-live="polite">
        {status}
      </div>
      {note.audioFileId && url ? (
        <audio className="raudio" controls src={url} aria-label="Audio de la nota" />
      ) : null}
      <div className="rrow">
        <button type="button" className="btn" onClick={() => upload.current?.click()}>
          <IconUpload />
          Subir audio
        </button>
        {note.audioFileId ? (
          <button
            type="button"
            className="btn"
            onClick={() => onChange({ audioFileId: undefined, dur: 0 })}
          >
            Quitar audio
          </button>
        ) : null}
        <input
          ref={upload}
          type="file"
          accept="audio/*"
          hidden
          aria-label="Archivo de audio"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            void onUpload(f);
          }}
        />
      </div>
      <div className="vlab">Transcripción</div>
      <textarea
        ref={textRef}
        className="vtext"
        aria-label="Transcripción"
        placeholder="La transcripción aparece aquí; también puedes escribirla."
        defaultValue={note.text ?? ''}
        onChange={(e) => onChange({ text: e.target.value })}
      />
    </div>
  );
}
