import React, { useState, useRef, useEffect } from 'react';
import { Film, Image as ImageIcon, FileText, Layout, X, Plus, GripVertical, RotateCcw, ArrowRight, ArrowDown, Sparkles, Save, FolderOpen, Zap, Hash, Download } from 'lucide-react';

export default function StoryboardTool() {
  const [stage, setStage] = useState('landing');
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [frames, setFrames] = useState([]);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [scrubTime, setScrubTime] = useState(0);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [projectTitle, setProjectTitle] = useState('Untitled');
  const [autoSaveStatus, setAutoSaveStatus] = useState('');
  const [hasSavedProject, setHasSavedProject] = useState(false);

  // NEW: detection mode
  const [detectionMode, setDetectionMode] = useState('auto'); // 'auto' or 'manual'
  const [targetShots, setTargetShots] = useState(20);

  // NEW: high-res PNG export progress
  const [pngExportProgress, setPngExportProgress] = useState(0);
  const [pngExportStatus, setPngExportStatus] = useState('');

  const fileInputRef = useRef(null);
  const projectFileInputRef = useRef(null);
  const previewVideoRef = useRef(null);

  // ============ AUTO-SAVE ============
  const STORAGE_KEY = 'momomoto-storyboard-autosave';
  const EMAIL_KEY = 'momomoto-storyboard-email';

  // Check for saved project + remembered email on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.frames && data.frames.length > 0) setHasSavedProject(true);
      }
      const rememberedEmail = localStorage.getItem(EMAIL_KEY);
      if (rememberedEmail) setEmail(rememberedEmail);
    } catch (e) { /* ignore */ }
  }, []);

  // Auto-save on changes during edit
  useEffect(() => {
    if (stage !== 'edit' || frames.length === 0) return;
    const timer = setTimeout(() => {
      try {
        const data = { projectTitle, frames, videoDuration, savedAt: new Date().toISOString() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setAutoSaveStatus('SAVED ' + new Date().toLocaleTimeString());
        setTimeout(() => setAutoSaveStatus(''), 2500);
      } catch (e) {
        setAutoSaveStatus('SAVE FAILED — STORAGE FULL');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [frames, projectTitle, stage, videoDuration]);

  const restoreAutoSave = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const data = JSON.parse(saved);
      setProjectTitle(data.projectTitle || 'Untitled');
      setFrames(data.frames || []);
      setVideoDuration(data.videoDuration || 0);
      setStage('edit');
    } catch (e) {
      alert('Could not restore project');
    }
  };

  const clearAutoSave = () => {
    if (!window.confirm('Discard the saved project? This cannot be undone.')) return;
    localStorage.removeItem(STORAGE_KEY);
    setHasSavedProject(false);
  };

  // ============ DOWNLOAD / UPLOAD PROJECT FILE ============
  const downloadProject = () => {
    const data = { projectTitle, frames, videoDuration, savedAt: new Date().toISOString(), version: 1 };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectTitle.toLowerCase().replace(/\s+/g, '-')}.momoboard`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleProjectFileUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.frames) throw new Error('Invalid file');
        setProjectTitle(data.projectTitle || 'Untitled');
        setFrames(data.frames || []);
        setVideoDuration(data.videoDuration || 0);
        setStage('edit');
      } catch (err) {
        alert('Could not read project file. Make sure it\'s a .momoboard file.');
      }
    };
    reader.readAsText(file);
  };

  // ============ VIDEO HANDLING ============
  const handleFile = (file) => {
    if (!file || !file.type.startsWith('video/')) return;
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setStage('mode'); // NEW: go to mode selection instead of straight to processing
  };

  // ============ FRAME EXTRACTION ============
  useEffect(() => {
    if (stage !== 'processing' || !videoUrl) return;

    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = async () => {
      setVideoDuration(video.duration);
      const canvas = document.createElement('canvas');
      const w = 480;
      const h = Math.round((video.videoHeight / video.videoWidth) * w);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      // Sample frames densely for analysis
      const sampleInterval = Math.max(0.4, video.duration / 80);
      const samples = [];
      let prevImageData = null;

      setProgressLabel('SAMPLING');
      for (let t = 0; t < video.duration; t += sampleInterval) {
        await seekTo(video, t);
        ctx.drawImage(video, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        let diff = 0;
        if (prevImageData) {
          const d1 = imageData.data;
          const d2 = prevImageData.data;
          for (let i = 0; i < d1.length; i += 400) {
            diff += Math.abs(d1[i] - d2[i]) + Math.abs(d1[i+1] - d2[i+1]) + Math.abs(d1[i+2] - d2[i+2]);
          }
        }
        samples.push({ time: t, diff, dataUrl: canvas.toDataURL('image/jpeg', 0.85) });
        prevImageData = imageData;
        setProgress(Math.min(60, (t / video.duration) * 60));
      }

      setProgressLabel('FINDING SHOT BOUNDARIES');
      setProgress(70);

      // Find scene boundaries (cut points)
      let cutPoints;
      if (detectionMode === 'manual') {
        // Divide video into N equal segments
        cutPoints = [];
        for (let i = 0; i <= targetShots; i++) {
          cutPoints.push((i * video.duration) / targetShots);
        }
      } else {
        // Auto: find biggest diffs as cut points
        const sorted = [...samples].slice(1).sort((a, b) => b.diff - a.diff);
        const minGap = video.duration / 30;
        const targetCount = Math.min(15, Math.max(5, Math.ceil(video.duration / 6)));
        const picked = [0]; // always include start
        for (const s of sorted) {
          if (picked.length >= targetCount) break;
          if (picked.every(p => Math.abs(p - s.time) > minGap)) picked.push(s.time);
        }
        picked.push(video.duration); // always include end
        picked.sort((a, b) => a - b);
        cutPoints = picked;
      }

      setProgressLabel('CAPTURING BOOKENDS');
      setProgress(80);

      // For each shot (between two cut points), capture first frame and last frame
      const finalFrames = [];
      for (let i = 0; i < cutPoints.length - 1; i++) {
        const shotStart = cutPoints[i];
        const shotEnd = cutPoints[i + 1];
        const shotDuration = shotEnd - shotStart;

        // First frame: just after the cut (skip first 0.1s of motion blur if possible)
        const firstTime = Math.min(shotStart + Math.min(0.15, shotDuration * 0.05), shotEnd - 0.1);
        // Last frame: just before next cut (skip last 0.1s)
        const lastTime = Math.max(shotEnd - Math.min(0.2, shotDuration * 0.08), firstTime + 0.1);

        await seekTo(video, firstTime);
        ctx.drawImage(video, 0, 0, w, h);
        finalFrames.push({
          id: `f-${Date.now()}-${i}-in`,
          time: firstTime,
          dataUrl: canvas.toDataURL('image/jpeg', 0.85),
          note: '',
          shotType: '',
          shotNumber: i + 1,
          position: 'IN'
        });

        // Only add a "last" frame if the shot is long enough to have a meaningful end
        if (shotDuration > 0.6) {
          await seekTo(video, lastTime);
          ctx.drawImage(video, 0, 0, w, h);
          finalFrames.push({
            id: `f-${Date.now()}-${i}-out`,
            time: lastTime,
            dataUrl: canvas.toDataURL('image/jpeg', 0.85),
            note: '',
            shotType: '',
            shotNumber: i + 1,
            position: 'OUT'
          });
        }
        setProgress(80 + (i / cutPoints.length) * 18);
      }

      setProgress(100);
      setProgressLabel('READY');
      setTimeout(() => {
        setFrames(finalFrames);
        setStage('edit');
      }, 500);
    };
  }, [stage, videoUrl, detectionMode, targetShots]);

  const seekTo = (video, time) => new Promise((resolve) => {
    const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
  });

  const captureCurrentFrame = () => {
    const video = previewVideoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    const w = 480;
    const h = Math.round((video.videoHeight / video.videoWidth) * w);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const newFrame = {
      id: `f-${Date.now()}`,
      time: video.currentTime,
      dataUrl,
      note: '',
      shotType: '',
      shotNumber: null,
      position: 'CUSTOM'
    };
    setFrames([...frames, newFrame].sort((a, b) => a.time - b.time));
  };

  const deleteFrame = (id) => setFrames(frames.filter(f => f.id !== id));
  const updateFrame = (id, patch) => setFrames(frames.map(f => f.id === id ? { ...f, ...patch } : f));

  const handleDragStart = (idx) => setDraggedIdx(idx);
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    const next = [...frames];
    const [moved] = next.splice(draggedIdx, 1);
    next.splice(idx, 0, moved);
    setDraggedIdx(idx);
    setFrames(next);
  };
  const handleDragEnd = () => setDraggedIdx(null);

 const submitEmailPing = async (emailToSend) => {
    try {
      await fetch('https://formspree.io/f/xvzyapek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email: emailToSend, project: projectTitle, frames: frames.length })
      });
    } catch (err) { console.error(err); }
  };

  const handleGateSubmit = async () => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) { setEmailError('Try again. Real email this time.'); return; }
    setEmailError('');
    try {
      if (rememberMe) localStorage.setItem(EMAIL_KEY, email);
      else localStorage.removeItem(EMAIL_KEY);
    } catch { /* ignore */ }
    await submitEmailPing(email);
    setStage('export');
  };

  // Remembered users skip the gate and go straight to export
  const startExport = () => {
    let remembered = null;
    try { remembered = localStorage.getItem(EMAIL_KEY); } catch { /* ignore */ }
    if (remembered) {
      setEmail(remembered);
      submitEmailPing(remembered);
      setStage('export');
    } else {
      setStage('gate');
    }
  };

  const forgetMe = () => {
    try { localStorage.removeItem(EMAIL_KEY); } catch { /* ignore */ }
    setEmail('');
    setStage('gate');
  };
  const formatTime = (t) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const f = Math.floor((t % 1) * 24);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}:${String(f).padStart(2,'0')}`;
  };

  const escapeHtml = (s) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // ============ EXPORTS ============
  const exportPDF = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const framesHtml = frames.map((f, i) => `
      <div class="frame">
        <div class="frame-img-wrap">
          <img src="${f.dataUrl}" />
          <div class="frame-num">${String(i + 1).padStart(3, '0')}${f.shotNumber ? ` · SH${String(f.shotNumber).padStart(2,'0')}${f.position ? '·'+f.position : ''}` : ''}</div>
        </div>
        <div class="frame-meta">
          <div class="frame-tc">${formatTime(f.time)}</div>
          ${f.shotType ? `<div class="frame-shot">${escapeHtml(f.shotType)}</div>` : '<div class="frame-shot">—</div>'}
          ${f.note ? `<div class="frame-note">${escapeHtml(f.note)}</div>` : ''}
        </div>
      </div>
    `).join('');
    w.document.write(`
      <!DOCTYPE html><html><head><title>${escapeHtml(projectTitle)}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Times New Roman', serif; background: #f2efe6; color: #0a0908; margin: 0; padding: 20px; }
        .header { padding-bottom: 16px; margin-bottom: 28px; border-bottom: 2px solid #0a0908; }
        .header-top { font-family: 'Courier New', monospace; font-size: 8pt; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 8px; display: flex; justify-content: space-between; }
        .title { font-size: 56pt; font-weight: 400; line-height: 0.92; letter-spacing: -2px; }
        .title em { font-style: italic; color: #c44232; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 18px; }
        .frame { break-inside: avoid; }
        .frame-img-wrap { position: relative; aspect-ratio: 16/9; overflow: hidden; background: #000; }
        .frame-img-wrap img { width: 100%; height: 100%; object-fit: cover; }
        .frame-num { position: absolute; top: 0; left: 0; background: #c44232; color: #f2efe6; padding: 4px 10px; font-family: 'Courier New', monospace; font-size: 9pt; letter-spacing: 1px; font-weight: bold; }
        .frame-meta { padding-top: 8px; }
        .frame-tc { font-family: 'Courier New', monospace; font-size: 8pt; letter-spacing: 1.5px; }
        .frame-shot { font-family: 'Courier New', monospace; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; font-size: 9pt; margin-top: 2px; }
        .frame-note { font-style: italic; font-size: 10pt; margin-top: 4px; line-height: 1.35; max-width: 90%; }
        .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #0a0908; font-family: 'Courier New', monospace; font-size: 7pt; letter-spacing: 3px; text-transform: uppercase; display: flex; justify-content: space-between; }
      </style></head><body>
        <div class="header">
          <div class="header-top">
            <span>Storyboard / Issue No. 01</span>
            <span>${frames.length.toString().padStart(3, '0')} Frames</span>
            <span>${new Date().toLocaleDateString()}</span>
          </div>
          <div class="title">${escapeHtml(projectTitle)}<em>.</em></div>
        </div>
        <div class="grid">${framesHtml}</div>
        <div class="footer"><span>— END —</span><span>Momomoto Studios</span></div>
      </body></html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const exportPoster = async () => {
    const cols = 3;
    const rows = Math.ceil(frames.length / cols);
    const cellW = 640;
    const cellH = 360;
    const gap = 28;
    const padding = 100;
    const headerH = 200;
    const footerH = 80;
    const W = padding * 2 + cols * cellW + (cols - 1) * gap;
    const H = padding * 2 + headerH + rows * cellH + (rows - 1) * gap + footerH;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f2efe6';
    ctx.fillRect(0, 0, W, H);

    const grain = ctx.createImageData(W, H);
    for (let i = 0; i < grain.data.length; i += 4) {
      const v = 200 + Math.random() * 40;
      grain.data[i] = grain.data[i+1] = grain.data[i+2] = v;
      grain.data[i+3] = 22;
    }
    ctx.putImageData(grain, 0, 0);

    ctx.fillStyle = '#0a0908';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillText('STORYBOARD / ISSUE No. 01', padding, padding + 20);
    ctx.fillText(`${frames.length.toString().padStart(3, '0')} FRAMES`, W / 2 - 50, padding + 20);
    ctx.fillText(new Date().toLocaleDateString().toUpperCase(), W - padding - 100, padding + 20);

    ctx.strokeStyle = '#0a0908';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding + 36);
    ctx.lineTo(W - padding, padding + 36);
    ctx.stroke();

    ctx.fillStyle = '#0a0908';
    ctx.font = '160px Georgia, "Times New Roman", serif';
    ctx.fillText(projectTitle, padding, padding + 170);
    const titleWidth = ctx.measureText(projectTitle).width;
    ctx.fillStyle = '#c44232';
    ctx.font = 'italic 160px Georgia, "Times New Roman", serif';
    ctx.fillText('.', padding + titleWidth, padding + 170);

    const loadImage = (src) => new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.src = src;
    });

    for (let i = 0; i < frames.length; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = padding + c * (cellW + gap);
      const y = padding + headerH + r * (cellH + gap);

      const img = await loadImage(frames[i].dataUrl);
      const ar = img.width / img.height;
      const cellAr = cellW / cellH;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (ar > cellAr) { sw = img.height * cellAr; sx = (img.width - sw) / 2; }
      else { sh = img.width / cellAr; sy = (img.height - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, x, y, cellW, cellH);

      const tagText = frames[i].shotNumber ? `${String(i + 1).padStart(3, '0')} SH${String(frames[i].shotNumber).padStart(2,'0')}${frames[i].position ? '·'+frames[i].position : ''}` : String(i + 1).padStart(3, '0');
      ctx.font = 'bold 16px "Courier New", monospace';
      const tagW = ctx.measureText(tagText).width + 24;
      ctx.fillStyle = '#c44232';
      ctx.fillRect(x, y, tagW, 36);
      ctx.fillStyle = '#f2efe6';
      ctx.fillText(tagText, x + 12, y + 23);

      ctx.fillStyle = '#0a0908';
      ctx.font = '12px "Courier New", monospace';
      ctx.fillText(formatTime(frames[i].time), x, y + cellH + 18);
      if (frames[i].shotType) {
        ctx.font = 'bold 12px "Courier New", monospace';
        ctx.fillText(frames[i].shotType, x + 100, y + cellH + 18);
      }
    }

    ctx.fillStyle = '#0a0908';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillText('— END —', padding, H - padding / 2);
    const credit = 'MOMOMOTO STUDIOS';
    const cw = ctx.measureText(credit).width;
    ctx.fillText(credit, W - padding - cw, H - padding / 2);

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectTitle.toLowerCase().replace(/\s+/g, '-')}-storyboard.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };

  // ============ HIGH-RES FRAMES EXPORT (for Runway etc.) ============
  const exportFramesHighRes = async () => {
    if (frames.length === 0) { alert('No frames to export.'); return; }

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const sanitize = (s) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const projSlug = sanitize(projectTitle) || 'storyboard';

    const triggerDownload = (blob, filename) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    };

    // If we still have the original video loaded, re-extract at full native resolution.
    if (videoUrl) {
      setPngExportStatus('PREPARING VIDEO');
      setPngExportProgress(0);

      const video = document.createElement('video');
      video.src = videoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('video load failed'));
      }).catch(() => {});

      const fullW = video.videoWidth || 1920;
      const fullH = video.videoHeight || 1080;
      const canvas = document.createElement('canvas');
      canvas.width = fullW;
      canvas.height = fullH;
      const ctx = canvas.getContext('2d');

      setPngExportStatus(`EXTRACTING AT ${fullW}x${fullH}`);

      for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        await seekTo(video, f.time);
        await sleep(40); // let the frame settle
        ctx.drawImage(video, 0, 0, fullW, fullH);

        const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        const idxTag = String(i + 1).padStart(3, '0');
        const shotTag = f.shotNumber ? `_SH${String(f.shotNumber).padStart(2, '0')}` : '';
        const posTag = f.position && f.position !== 'CUSTOM' ? `_${f.position}` : (f.position === 'CUSTOM' ? '_CUSTOM' : '');
        const filename = `${projSlug}_${idxTag}${shotTag}${posTag}.png`;
        if (blob) triggerDownload(blob, filename);

        setPngExportProgress(((i + 1) / frames.length) * 100);
        await sleep(180); // spacing so the browser accepts multiple downloads
      }

      setPngExportStatus(`DONE · ${frames.length} PNGs AT ${fullW}x${fullH}`);
      setTimeout(() => { setPngExportStatus(''); setPngExportProgress(0); }, 4000);
      return;
    }

    // No original video (e.g. project loaded from file): export the stored frames as-is.
    setPngExportStatus('NO VIDEO LOADED — EXPORTING STORED FRAMES');
    setPngExportProgress(0);
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const blob = await (await fetch(f.dataUrl)).blob();
      const idxTag = String(i + 1).padStart(3, '0');
      const shotTag = f.shotNumber ? `_SH${String(f.shotNumber).padStart(2, '0')}` : '';
      const posTag = f.position && f.position !== 'CUSTOM' ? `_${f.position}` : '';
      triggerDownload(blob, `${projSlug}_${idxTag}${shotTag}${posTag}.jpg`);
      setPngExportProgress(((i + 1) / frames.length) * 100);
      await sleep(180);
    }
    setPngExportStatus('DONE · re-upload the video for full resolution');
    setTimeout(() => { setPngExportStatus(''); setPngExportProgress(0); }, 5000);
  };

  const reset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(null); setVideoUrl(null); setFrames([]); setProgress(0); setStage('landing');
  };

  // ============ STYLES ============
  const ink = '#0a0908';
  const paper = '#f2efe6';
  const red = '#c44232';
  const dim = '#6b6760';

  const isDark = stage === 'landing' || stage === 'processing' || stage === 'gate' || stage === 'mode';
  const bg = isDark ? ink : paper;
  const fg = isDark ? paper : ink;

  const grainBg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

  const btnGhost = (color) => ({
    background: 'transparent',
    color,
    border: `1px solid ${color}`,
    padding: '14px 20px',
    fontFamily: '"Courier New", monospace',
    fontSize: '11px',
    letterSpacing: '2.5px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 700,
    transition: 'all 0.2s'
  });

  const stageIdx = { landing: 'IDX 00', upload: 'IDX 01', mode: 'IDX 01.5', processing: 'IDX 02', edit: 'IDX 03', gate: 'IDX 04', export: 'IDX 05' };

  return (
    <div style={{
      minHeight: '100vh',
      background: bg,
      color: fg,
      fontFamily: 'Georgia, "Times New Roman", serif',
      transition: 'background 0.5s, color 0.5s',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1,
        opacity: isDark ? 0.12 : 0.18,
        backgroundImage: grainBg,
        mixBlendMode: isDark ? 'overlay' : 'multiply'
      }} />

      <div style={{ position: 'relative', zIndex: 2 }}>
        <header style={{
          padding: '16px 32px',
          borderBottom: `1px solid ${isDark ? '#2a2724' : ink}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: '"Courier New", monospace',
          fontSize: '10px',
          letterSpacing: '2.5px',
          textTransform: 'uppercase'
        }}>
          <div>◐ MOMOMOTO / STORYBOARD <span style={{ color: dim, marginLeft: '8px' }}>v02</span></div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <span style={{ color: dim }}>ISSUE 01</span>
            <span>{stageIdx[stage]}</span>
          </div>
        </header>

        {/* ============ LANDING ============ */}
        {stage === 'landing' && (
          <main style={{ padding: '40px 32px 80px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto auto',
              gap: '24px',
              fontFamily: '"Courier New", monospace',
              fontSize: '10px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: dim,
              marginBottom: '60px',
              paddingBottom: '20px',
              borderBottom: '1px solid #2a2724'
            }}>
              <div>VOL.01 / WINTER ED.</div>
              <div>RUNTIME: ANY</div>
              <div>FORMAT: MP4 · MOV · WEBM</div>
              <div style={{ color: red }}>● LIVE</div>
            </div>

            <div style={{ marginBottom: '40px' }}>
              <div style={{
                fontSize: 'clamp(80px, 16vw, 240px)',
                lineHeight: '0.85',
                letterSpacing: '-0.06em',
                fontWeight: 400,
                marginLeft: '-8px'
              }}>
                Video,<br />
                <span style={{ display: 'inline-block', transform: 'translateX(8vw)' }}>
                  <em style={{ color: red, fontStyle: 'italic' }}>frame</em>
                </span><br />
                by frame.
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: '24px',
              alignItems: 'end',
              marginBottom: '40px',
              paddingTop: '32px',
              borderTop: '1px solid #2a2724'
            }}>
              <div style={{
                gridColumn: '1 / 3',
                fontSize: 'clamp(18px, 2vw, 26px)',
                lineHeight: 1.3,
                fontStyle: 'italic'
              }}>
                A storyboard generator for filmmakers who'd rather be on set than on Photoshop.
              </div>
              <div style={{
                fontFamily: '"Courier New", monospace',
                fontSize: '11px',
                letterSpacing: '2px',
                color: dim,
                textTransform: 'uppercase',
                lineHeight: 1.6
              }}>
                Built by directors.<br />For directors.
              </div>
              <div style={{ textAlign: 'right' }}>
                <button
                  onClick={() => setStage('upload')}
                  style={{
                    background: red,
                    color: paper,
                    border: 'none',
                    padding: '20px 28px',
                    fontFamily: '"Courier New", monospace',
                    fontSize: '12px',
                    letterSpacing: '3px',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translate(-2px, -2px)'; e.currentTarget.style.boxShadow = `4px 4px 0 ${paper}`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translate(0, 0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  START <ArrowRight size={14} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* RESUME / LOAD project row */}
            <div style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
              marginBottom: '80px',
              paddingTop: '24px',
              borderTop: '1px solid #2a2724'
            }}>
              {hasSavedProject && (
                <>
                  <button onClick={restoreAutoSave} style={{
                    background: 'transparent',
                    color: paper,
                    border: `1px solid ${red}`,
                    padding: '14px 20px',
                    fontFamily: '"Courier New", monospace',
                    fontSize: '11px',
                    letterSpacing: '2.5px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontWeight: 700
                  }}>
                    <RotateCcw size={14} /> RESUME LAST PROJECT
                  </button>
                  <button onClick={clearAutoSave} style={{
                    background: 'transparent',
                    color: dim,
                    border: 'none',
                    fontFamily: '"Courier New", monospace',
                    fontSize: '10px',
                    letterSpacing: '2px',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}>
                    DISCARD
                  </button>
                </>
              )}
              <button onClick={() => projectFileInputRef.current?.click()} style={{
                background: 'transparent',
                color: paper,
                border: `1px solid ${paper}`,
                padding: '14px 20px',
                fontFamily: '"Courier New", monospace',
                fontSize: '11px',
                letterSpacing: '2.5px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                fontWeight: 700
              }}>
                <FolderOpen size={14} /> OPEN .MOMOBOARD FILE
              </button>
              <input
                ref={projectFileInputRef}
                type="file"
                accept=".momoboard,.json"
                onChange={(e) => handleProjectFileUpload(e.target.files[0])}
                style={{ display: 'none' }}
              />
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, 1fr)',
              gap: '20px 24px',
              borderTop: '1px solid #2a2724',
              paddingTop: '40px'
            }}>
              <div style={{ gridColumn: '1 / 4' }}>
                <div style={{ fontSize: '88px', lineHeight: 1, color: red, fontStyle: 'italic' }}>01</div>
                <div style={{ fontFamily: '"Courier New", monospace', fontSize: '10px', letterSpacing: '2.5px', margin: '12px 0 8px' }}>UPLOAD</div>
                <div style={{ fontSize: '13px', color: dim, lineHeight: 1.6 }}>
                  Drop in your video. Stays on your device. Nothing uploaded.
                </div>
              </div>
              <div style={{ gridColumn: '5 / 8', paddingTop: '40px' }}>
                <div style={{ fontSize: '88px', lineHeight: 1 }}>02</div>
                <div style={{ fontFamily: '"Courier New", monospace', fontSize: '10px', letterSpacing: '2.5px', margin: '12px 0 8px' }}>AUTO-CUT</div>
                <div style={{ fontSize: '13px', color: dim, lineHeight: 1.6 }}>
                  Bookend detection: first frame and last frame of every shot.
                </div>
              </div>
              <div style={{ gridColumn: '8 / 11', paddingTop: '20px' }}>
                <div style={{ fontSize: '88px', lineHeight: 1, fontStyle: 'italic' }}>03</div>
                <div style={{ fontFamily: '"Courier New", monospace', fontSize: '10px', letterSpacing: '2.5px', margin: '12px 0 8px' }}>REFINE</div>
                <div style={{ fontSize: '13px', color: dim, lineHeight: 1.6 }}>
                  Add, kill, rearrange. Annotate. Auto-saves as you work.
                </div>
              </div>
              <div style={{ gridColumn: '10 / 13', paddingTop: '60px' }}>
                <div style={{ fontSize: '88px', lineHeight: 1, color: red }}>04</div>
                <div style={{ fontFamily: '"Courier New", monospace', fontSize: '10px', letterSpacing: '2.5px', margin: '12px 0 8px' }}>EXPORT</div>
                <div style={{ fontSize: '13px', color: dim, lineHeight: 1.6 }}>
                  PDF, poster, .momoboard project file. Take it offline.
                </div>
              </div>
            </div>

            <div style={{
              marginTop: '120px',
              padding: '20px 0',
              borderTop: '1px solid #2a2724',
              borderBottom: '1px solid #2a2724',
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: '"Courier New", monospace',
              fontSize: '10px',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              color: dim,
              overflow: 'hidden',
              whiteSpace: 'nowrap'
            }}>
              <span>FRAME × FRAME</span>
              <span>·</span>
              <span>SCENE × SCENE</span>
              <span>·</span>
              <span>CUT × CUT</span>
              <span>·</span>
              <span>BUILT IN BOMBAY</span>
              <span>·</span>
              <span>FRAME × FRAME</span>
              <span>·</span>
              <span>SCENE × SCENE</span>
            </div>
          </main>
        )}

        {/* ============ UPLOAD ============ */}
        {stage === 'upload' && (
          <main style={{ padding: '60px 32px', minHeight: 'calc(100vh - 50px)' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '40px',
                alignItems: 'end',
                marginBottom: '60px'
              }}>
                <div>
                  <div style={{ fontFamily: '"Courier New", monospace', fontSize: '10px', letterSpacing: '3px', color: red, marginBottom: '16px' }}>
                    STEP 01 / FOUR
                  </div>
                  <h1 style={{
                    fontSize: 'clamp(60px, 9vw, 140px)',
                    lineHeight: 0.9,
                    margin: 0,
                    letterSpacing: '-0.04em',
                    fontWeight: 400
                  }}>
                    Drop the<br />
                    <em style={{ fontStyle: 'italic' }}>film</em>.
                  </h1>
                </div>
                <div style={{ paddingBottom: '20px', textAlign: 'right' }}>
                  <div style={{
                    fontSize: '16px',
                    fontStyle: 'italic',
                    lineHeight: 1.5,
                    color: dim,
                    maxWidth: '320px',
                    marginLeft: 'auto'
                  }}>
                    Up to 200MB. MP4, MOV, WebM. Anything your camera shoots.
                  </div>
                </div>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = red; }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = ink; }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = ink;
                  handleFile(e.dataTransfer.files[0]);
                }}
                style={{
                  border: `2px solid ${ink}`,
                  padding: '120px 40px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
              >
                <div style={{ position: 'absolute', top: 12, left: 12, fontFamily: '"Courier New", monospace', fontSize: '9px', letterSpacing: '2px', color: dim }}>┌ NW</div>
                <div style={{ position: 'absolute', top: 12, right: 12, fontFamily: '"Courier New", monospace', fontSize: '9px', letterSpacing: '2px', color: dim }}>NE ┐</div>
                <div style={{ position: 'absolute', bottom: 12, left: 12, fontFamily: '"Courier New", monospace', fontSize: '9px', letterSpacing: '2px', color: dim }}>└ SW</div>
                <div style={{ position: 'absolute', bottom: 12, right: 12, fontFamily: '"Courier New", monospace', fontSize: '9px', letterSpacing: '2px', color: dim }}>SE ┘</div>

                <ArrowDown size={64} strokeWidth={1} style={{ color: red, marginBottom: '24px' }} />
                <div style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontStyle: 'italic', marginBottom: '12px' }}>
                  Drag your video here.
                </div>
                <div style={{ fontFamily: '"Courier New", monospace', fontSize: '11px', letterSpacing: '3px', color: dim, textTransform: 'uppercase' }}>
                  or click anywhere
                </div>
                <input ref={fileInputRef} type="file" accept="video/*" onChange={(e) => handleFile(e.target.files[0])} style={{ display: 'none' }} />
              </div>

              <button
                onClick={() => setStage('landing')}
                style={{
                  marginTop: '32px',
                  background: 'transparent',
                  color: dim,
                  border: 'none',
                  fontFamily: '"Courier New", monospace',
                  fontSize: '11px',
                  letterSpacing: '2px',
                  cursor: 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                ← BACK
              </button>
            </div>
          </main>
        )}

        {/* ============ MODE SELECTION (NEW) ============ */}
        {stage === 'mode' && (
          <main style={{ padding: '40px 32px', minHeight: 'calc(100vh - 50px)', display: 'flex', alignItems: 'center' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
              <div style={{ marginBottom: '60px' }}>
                <div style={{ fontFamily: '"Courier New", monospace', fontSize: '11px', letterSpacing: '3px', color: red, marginBottom: '24px' }}>
                  STEP 02 / DETECTION MODE
                </div>
                <h1 style={{
                  fontSize: 'clamp(56px, 9vw, 130px)',
                  lineHeight: 0.88,
                  margin: '0 0 16px',
                  letterSpacing: '-0.04em',
                  fontWeight: 400
                }}>
                  How should I<br />read it<em style={{ fontStyle: 'italic', color: red }}>?</em>
                </h1>
                <p style={{ fontSize: '16px', color: dim, fontStyle: 'italic', maxWidth: '600px', lineHeight: 1.5 }}>
                  Both modes capture two frames per shot — the bookends. The first frame in, and the last frame out.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Auto mode */}
                <div
                  onClick={() => { setDetectionMode('auto'); setStage('processing'); }}
                  style={{
                    border: `1px solid ${detectionMode === 'auto' ? red : '#2a2724'}`,
                    padding: '32px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: detectionMode === 'auto' ? 'rgba(196, 66, 50, 0.08)' : 'transparent'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = red; }}
                  onMouseLeave={(e) => { if (detectionMode !== 'auto') e.currentTarget.style.borderColor = '#2a2724'; }}
                >
                  <Zap size={40} strokeWidth={1} style={{ color: red, marginBottom: '24px' }} />
                  <div style={{ fontSize: '40px', marginBottom: '12px', letterSpacing: '-0.02em' }}>
                    Auto<em style={{ color: red, fontStyle: 'italic' }}>.</em>
                  </div>
                  <p style={{ fontSize: '14px', color: dim, fontStyle: 'italic', lineHeight: 1.5, marginBottom: '32px' }}>
                    I'll find the cuts by detecting big visual changes between frames. Good for cut-heavy films, ads, music videos.
                  </p>
                  <div style={{
                    fontFamily: '"Courier New", monospace',
                    fontSize: '11px',
                    letterSpacing: '2.5px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    USE AUTO <ArrowRight size={14} strokeWidth={2.5} />
                  </div>
                </div>

                {/* Manual mode */}
                <div style={{
                  border: `1px solid ${detectionMode === 'manual' ? red : '#2a2724'}`,
                  padding: '32px',
                  background: detectionMode === 'manual' ? 'rgba(196, 66, 50, 0.08)' : 'transparent',
                  transition: 'all 0.2s'
                }}>
                  <Hash size={40} strokeWidth={1} style={{ color: red, marginBottom: '24px' }} />
                  <div style={{ fontSize: '40px', marginBottom: '12px', letterSpacing: '-0.02em' }}>
                    Manual<em style={{ color: red, fontStyle: 'italic' }}>.</em>
                  </div>
                  <p style={{ fontSize: '14px', color: dim, fontStyle: 'italic', lineHeight: 1.5, marginBottom: '24px' }}>
                    Tell me how many shots. I'll divide the video evenly and grab bookends from each segment.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
                    <input
                      type="number"
                      min="2"
                      max="100"
                      value={targetShots}
                      onChange={(e) => setTargetShots(Math.max(2, Math.min(100, parseInt(e.target.value) || 2)))}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderBottom: `2px solid ${paper}`,
                        color: paper,
                        fontFamily: 'Georgia, serif',
                        fontSize: '64px',
                        width: '120px',
                        padding: '4px 0',
                        outline: 'none',
                        fontStyle: 'italic'
                      }}
                    />
                    <span style={{ fontFamily: '"Courier New", monospace', fontSize: '12px', letterSpacing: '2px', color: dim }}>SHOTS</span>
                  </div>
                  <p style={{ fontSize: '12px', color: dim, fontStyle: 'italic', marginBottom: '24px' }}>
                    = approx {targetShots * 2} frames in your storyboard
                  </p>
                  <button
                    onClick={() => { setDetectionMode('manual'); setStage('processing'); }}
                    style={{
                      background: red,
                      color: paper,
                      border: 'none',
                      padding: '14px 24px',
                      fontFamily: '"Courier New", monospace',
                      fontSize: '11px',
                      letterSpacing: '2.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    USE MANUAL <ArrowRight size={14} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              <button
                onClick={() => setStage('upload')}
                style={{
                  marginTop: '32px',
                  background: 'transparent',
                  color: dim,
                  border: 'none',
                  fontFamily: '"Courier New", monospace',
                  fontSize: '11px',
                  letterSpacing: '2px',
                  cursor: 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                ← BACK
              </button>
            </div>
          </main>
        )}

        {/* ============ PROCESSING ============ */}
        {stage === 'processing' && (
          <main style={{ padding: '40px 32px', minHeight: 'calc(100vh - 50px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '60px',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontFamily: '"Courier New", monospace', fontSize: '11px', letterSpacing: '3px', color: red, marginBottom: '20px' }}>
                    ◐ {progressLabel}
                  </div>
                  <h1 style={{
                    fontSize: 'clamp(56px, 9vw, 130px)',
                    lineHeight: 0.9,
                    margin: 0,
                    letterSpacing: '-0.04em',
                    fontWeight: 400
                  }}>
                    Reading.<br />
                    <em style={{ fontStyle: 'italic', color: dim }}>Cutting.</em><br />
                    Composing.
                  </h1>
                </div>
                <div>
                  <div style={{
                    fontSize: 'clamp(120px, 18vw, 280px)',
                    lineHeight: 0.85,
                    color: red,
                    fontWeight: 400
                  }}>
                    {String(Math.round(progress)).padStart(2, '0')}
                    <span style={{ fontSize: '0.3em', color: paper, marginLeft: '8px' }}>%</span>
                  </div>
                  <div style={{
                    height: '4px',
                    background: '#2a2724',
                    marginTop: '24px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      width: `${progress}%`,
                      background: red,
                      transition: 'width 0.3s'
                    }} />
                  </div>
                  <div style={{
                    fontFamily: '"Courier New", monospace',
                    fontSize: '11px',
                    letterSpacing: '2px',
                    color: dim,
                    marginTop: '16px',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span>RUNTIME / {formatTime(videoDuration)}</span>
                    <span>MODE / {detectionMode.toUpperCase()}{detectionMode === 'manual' ? ` · ${targetShots} SHOTS` : ''}</span>
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* ============ EDIT ============ */}
        {stage === 'edit' && (
          <main style={{ padding: '32px' }}>
            <div style={{
              borderBottom: `2px solid ${ink}`,
              paddingBottom: '20px',
              marginBottom: '32px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: '"Courier New", monospace',
                fontSize: '10px',
                letterSpacing: '2.5px',
                textTransform: 'uppercase',
                marginBottom: '12px',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <span>STEP 03 / REFINE</span>
                <span>{frames.length.toString().padStart(3, '0')} FRAMES</span>
                <span>RUNTIME {formatTime(videoDuration)}</span>
                <span style={{ color: autoSaveStatus ? red : dim }}>
                  {autoSaveStatus || '○ AUTO-SAVE ON'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <input
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: ink,
                      fontFamily: 'Georgia, serif',
                      fontSize: 'clamp(56px, 8vw, 120px)',
                      lineHeight: 0.9,
                      letterSpacing: '-0.03em',
                      padding: 0,
                      outline: 'none',
                      width: 'auto',
                      minWidth: '200px',
                      maxWidth: '100%'
                    }}
                  />
                  <span style={{ color: red, fontSize: 'clamp(56px, 8vw, 120px)', fontStyle: 'italic', lineHeight: 0.9 }}>.</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', paddingBottom: '20px', flexWrap: 'wrap' }}>
                  <button onClick={downloadProject} style={btnGhost(ink)}>
                    <Save size={14} /> SAVE FILE
                  </button>
                  <button onClick={reset} style={btnGhost(ink)}>
                    <RotateCcw size={14} /> NEW
                  </button>
                  <button
                    onClick={startExport}
                    disabled={frames.length === 0}
                    style={{
                      background: red,
                      color: paper,
                      border: 'none',
                      padding: '14px 24px',
                      fontFamily: '"Courier New", monospace',
                      fontSize: '11px',
                      letterSpacing: '2.5px',
                      fontWeight: 700,
                      cursor: frames.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: frames.length === 0 ? 0.4 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    EXPORT <ArrowRight size={14} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>

            {videoUrl && (
              <div style={{
                border: `1px solid ${ink}`,
                padding: '24px',
                marginBottom: '40px',
                display: 'grid',
                gridTemplateColumns: 'minmax(300px, 1fr) auto',
                gap: '32px',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.4)'
              }}>
                <div>
                  <div style={{ fontFamily: '"Courier New", monospace', fontSize: '10px', letterSpacing: '2.5px', color: dim, marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>SCRUB · ADD CUSTOM FRAMES</span>
                    <span style={{ color: red }}>● LIVE</span>
                  </div>
                  <video
                    ref={previewVideoRef}
                    src={videoUrl}
                    controls
                    onTimeUpdate={(e) => setScrubTime(e.target.currentTime)}
                    style={{ width: '100%', maxHeight: '260px', background: '#000', display: 'block' }}
                  />
                </div>
                <div style={{ textAlign: 'center', minWidth: '240px' }}>
                  <div style={{
                    fontSize: '48px',
                    color: red,
                    marginBottom: '4px',
                    fontStyle: 'italic',
                    letterSpacing: '-1px'
                  }}>
                    {formatTime(scrubTime)}
                  </div>
                  <div style={{ fontFamily: '"Courier New", monospace', fontSize: '9px', letterSpacing: '2px', color: dim, marginBottom: '16px' }}>
                    CURRENT TIMECODE
                  </div>
                  <button
                    onClick={captureCurrentFrame}
                    style={{
                      background: ink,
                      color: paper,
                      border: 'none',
                      padding: '14px 24px',
                      fontFamily: '"Courier New", monospace',
                      fontSize: '11px',
                      letterSpacing: '2.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <Plus size={14} strokeWidth={2.5} /> CAPTURE FRAME
                  </button>
                </div>
              </div>
            )}

            {!videoUrl && (
              <div style={{
                border: `1px dashed ${ink}`,
                padding: '24px',
                marginBottom: '32px',
                fontStyle: 'italic',
                color: dim,
                fontSize: '14px'
              }}>
                Project loaded from file. To add new frames from the original video, you'd need to re-upload it. Your existing frames and notes are all preserved.
              </div>
            )}

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '20px',
              borderTop: `1px solid ${ink}`,
              paddingTop: '20px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ fontSize: '32px', fontStyle: 'italic' }}>
                The cuts.
              </div>
              <div style={{ fontFamily: '"Courier New", monospace', fontSize: '10px', letterSpacing: '2.5px', color: dim }}>
                DRAG TO REORDER · HOLD AND DROP
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '32px 24px'
            }}>
              {frames.map((f, idx) => (
                <div
                  key={f.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  style={{
                    cursor: 'move',
                    opacity: draggedIdx === idx ? 0.3 : 1,
                    transition: 'opacity 0.2s'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    marginBottom: '8px'
                  }}>
                    <div style={{
                      fontSize: '40px',
                      lineHeight: 0.9,
                      color: red,
                      fontStyle: 'italic',
                      flexShrink: 0
                    }}>
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div style={{ flex: 1, paddingTop: '14px' }}>
                      <div style={{ fontFamily: '"Courier New", monospace', fontSize: '9px', letterSpacing: '2px', color: dim }}>
                        TC {formatTime(f.time)}
                      </div>
                      {f.shotNumber && (
                        <div style={{ fontFamily: '"Courier New", monospace', fontSize: '9px', letterSpacing: '2px', color: red, fontWeight: 700, marginTop: '2px' }}>
                          SH{String(f.shotNumber).padStart(2,'0')} · {f.position}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteFrame(f.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: dim,
                        cursor: 'pointer',
                        padding: '4px',
                        marginTop: '6px'
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000', overflow: 'hidden', marginBottom: '12px' }}>
                    <img src={f.dataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={`Frame ${idx + 1}`} />
                    <GripVertical size={14} style={{ position: 'absolute', bottom: '6px', right: '6px', color: 'rgba(255,255,255,0.5)' }} />
                  </div>

                  <input
                    placeholder="SHOT TYPE"
                    value={f.shotType}
                    onChange={(e) => updateFrame(f.id, { shotType: e.target.value.toUpperCase() })}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `1px solid ${ink}`,
                      color: ink,
                      fontFamily: '"Courier New", monospace',
                      fontSize: '11px',
                      letterSpacing: '2px',
                      padding: '6px 0',
                      marginBottom: '8px',
                      outline: 'none',
                      fontWeight: 700,
                      boxSizing: 'border-box'
                    }}
                  />
                  <textarea
                    placeholder="Director's note…"
                    value={f.note}
                    onChange={(e) => updateFrame(f.id, { note: e.target.value })}
                    rows={2}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      color: ink,
                      fontFamily: 'Georgia, serif',
                      fontStyle: 'italic',
                      fontSize: '14px',
                      padding: '4px 0',
                      outline: 'none',
                      resize: 'none',
                      lineHeight: 1.4,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              ))}
            </div>

            {frames.length === 0 && (
              <div style={{
                border: `1px dashed ${ink}`,
                padding: '80px',
                textAlign: 'center',
                fontStyle: 'italic',
                fontSize: '20px',
                color: dim
              }}>
                No frames yet. Scrub above and capture some.
              </div>
            )}
          </main>
        )}

        {/* ============ EMAIL GATE ============ */}
        {stage === 'gate' && (
          <main style={{ padding: '40px 32px', minHeight: 'calc(100vh - 50px)', display: 'flex', alignItems: 'center' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '60px',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontFamily: '"Courier New", monospace', fontSize: '11px', letterSpacing: '3px', color: red, marginBottom: '24px' }}>
                    STEP 04 / ALMOST THERE
                  </div>
                  <h1 style={{
                    fontSize: 'clamp(56px, 9vw, 130px)',
                    lineHeight: 0.88,
                    margin: '0 0 32px',
                    letterSpacing: '-0.04em',
                    fontWeight: 400
                  }}>
                    Where do<br />we send <em style={{ fontStyle: 'italic', color: red }}>it</em>?
                  </h1>
                  <p style={{ fontSize: '16px', color: dim, lineHeight: 1.6, fontStyle: 'italic', maxWidth: '440px' }}>
                    Your email unlocks the export. We'll occasionally share new tools and behind-the-scenes from the studio. Unsubscribe anytime — promise.
                  </p>
                </div>
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleGateSubmit()}
                    placeholder="you@studio.com"
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `2px solid ${emailError ? red : paper}`,
                      color: paper,
                      fontFamily: 'Georgia, serif',
                      fontStyle: 'italic',
                      fontSize: 'clamp(28px, 4vw, 48px)',
                      padding: '8px 0 16px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      marginBottom: '12px'
                    }}
                  />
                  {emailError && (
                    <div style={{ color: red, fontSize: '13px', marginBottom: '16px', fontStyle: 'italic' }}>{emailError}</div>
                  )}
                  <label
                    onClick={() => setRememberMe(!rememberMe)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      marginTop: '8px',
                      userSelect: 'none'
                    }}
                  >
                    <span style={{
                      width: '18px',
                      height: '18px',
                      border: `1px solid ${rememberMe ? red : dim}`,
                      background: rememberMe ? red : 'transparent',
                      color: paper,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      flexShrink: 0,
                      transition: 'all 0.2s'
                    }}>
                      {rememberMe ? '✓' : ''}
                    </span>
                    <span style={{
                      fontFamily: '"Courier New", monospace',
                      fontSize: '10px',
                      letterSpacing: '2.5px',
                      color: rememberMe ? paper : dim,
                      textTransform: 'uppercase',
                      transition: 'color 0.2s'
                    }}>
                      Remember me — skip this next time
                    </span>
                  </label>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                    <button
                      onClick={handleGateSubmit}
                      style={{
                        background: red,
                        color: paper,
                        border: 'none',
                        padding: '20px 32px',
                        fontFamily: '"Courier New", monospace',
                        fontSize: '12px',
                        letterSpacing: '3px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '12px',
                        flex: 1,
                        justifyContent: 'center'
                      }}
                    >
                      UNLOCK <ArrowRight size={14} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => setStage('edit')}
                      style={btnGhost(paper)}
                    >
                      ← BACK
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* ============ EXPORT ============ */}
        {stage === 'export' && (
          <main style={{ padding: '32px' }}>
            <div style={{ borderBottom: `2px solid ${ink}`, paddingBottom: '20px', marginBottom: '40px' }}>
              <div style={{
                fontFamily: '"Courier New", monospace',
                fontSize: '10px',
                letterSpacing: '2.5px',
                marginBottom: '12px',
                display: 'flex',
                gap: '16px',
                flexWrap: 'wrap',
                alignItems: 'baseline'
              }}>
                <span style={{ color: red }}>✓ UNLOCKED · STEP 05 / EXPORT</span>
                {email && (
                  <span style={{ color: dim }}>
                    {email.toUpperCase()}
                    <button
                      onClick={forgetMe}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: dim,
                        fontFamily: '"Courier New", monospace',
                        fontSize: '10px',
                        letterSpacing: '2.5px',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        marginLeft: '10px',
                        padding: 0,
                        textTransform: 'uppercase'
                      }}
                    >
                      Not you? Forget me
                    </button>
                  </span>
                )}
              </div>
              <h1 style={{
                fontSize: 'clamp(56px, 9vw, 130px)',
                lineHeight: 0.88,
                margin: 0,
                letterSpacing: '-0.04em',
                fontWeight: 400
              }}>
                Pick<br />your <em style={{ fontStyle: 'italic', color: red }}>format</em>.
              </h1>
            </div>

            {pngExportStatus && (
              <div style={{
                marginBottom: '32px',
                padding: '20px 24px',
                border: `1px solid ${red}`,
                background: 'rgba(196, 66, 50, 0.06)'
              }}>
                <div style={{
                  fontFamily: '"Courier New", monospace',
                  fontSize: '11px',
                  letterSpacing: '2.5px',
                  color: red,
                  fontWeight: 700,
                  marginBottom: '12px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>{pngExportStatus}</span>
                  <span>{Math.round(pngExportProgress)}%</span>
                </div>
                <div style={{ height: '4px', background: '#d8d2c4', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${pngExportProgress}%`, background: red, transition: 'width 0.2s' }} />
                </div>
              </div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '0',
              borderTop: `1px solid ${ink}`,
              borderLeft: `1px solid ${ink}`
            }}>
              {[
                { num: '01', icon: FileText, title: 'PDF', desc: 'Print-ready A4. Two frames per row, shot info inline.', action: exportPDF, label: 'OPEN PRINT' },
                { num: '02', icon: ImageIcon, title: 'POSTER', desc: 'Single shareable image. Three-column grid, oversized title.', action: exportPoster, label: 'DOWNLOAD PNG' },
                { num: '03', icon: Download, title: 'FRAMES', desc: 'Full-resolution PNG of every frame, named by shot. Drop straight into Runway as first / last frame.', action: exportFramesHighRes, label: 'EXPORT HI-RES', badge: 'AI-READY' },
                { num: '04', icon: Save, title: 'PROJECT', desc: 'Download as a .momoboard file. Re-open later or share with a collaborator.', action: downloadProject, label: 'SAVE .MOMOBOARD' },
                { num: '05', icon: Layout, title: 'WEB', desc: 'Stay in the editor. Auto-save keeps everything in this browser.', action: () => setStage('edit'), label: 'BACK TO EDITOR' },
              ].map((opt, i) => (
                <div
                  key={i}
                  onClick={opt.action}
                  style={{
                    borderRight: `1px solid ${ink}`,
                    borderBottom: `1px solid ${ink}`,
                    padding: '40px 32px',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    position: 'relative',
                    minHeight: '320px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background: opt.badge ? 'rgba(196, 66, 50, 0.05)' : 'transparent'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = ink; e.currentTarget.style.color = paper; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = opt.badge ? 'rgba(196, 66, 50, 0.05)' : 'transparent'; e.currentTarget.style.color = ink; }}
                >
                  {opt.badge && (
                    <div style={{
                      position: 'absolute',
                      top: '16px',
                      right: '16px',
                      background: red,
                      color: paper,
                      fontFamily: '"Courier New", monospace',
                      fontSize: '8px',
                      letterSpacing: '1.5px',
                      fontWeight: 700,
                      padding: '4px 8px'
                    }}>
                      {opt.badge}
                    </div>
                  )}
                  <div>
                    <div style={{
                      fontSize: '88px',
                      lineHeight: 0.9,
                      color: red,
                      marginBottom: '24px',
                      fontStyle: 'italic'
                    }}>
                      {opt.num}
                    </div>
                    <div style={{
                      fontSize: '40px',
                      letterSpacing: '-0.02em',
                      marginBottom: '12px'
                    }}>
                      {opt.title}.
                    </div>
                    <div style={{ fontSize: '14px', lineHeight: 1.6, fontStyle: 'italic', opacity: 0.7 }}>
                      {opt.desc}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: '"Courier New", monospace',
                    fontSize: '11px',
                    letterSpacing: '2.5px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginTop: '32px'
                  }}>
                    {opt.label} <ArrowRight size={14} strokeWidth={2.5} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: '40px',
              padding: '32px',
              border: `1px solid ${ink}`,
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: '24px',
              alignItems: 'center'
            }}>
              <Sparkles size={32} strokeWidth={1} style={{ color: red }} />
              <div>
                <div style={{ fontSize: '24px', fontStyle: 'italic', marginBottom: '4px' }}>
                  Need this for a real shoot?
                </div>
                <div style={{ fontSize: '14px', color: dim, lineHeight: 1.5 }}>
                  Momomoto Studios builds brand films from concept through final cut.
                </div>
              </div>
              <button
                onClick={() => window.open('https://momomotostudios.com', '_blank')}
                style={{
                  background: ink,
                  color: paper,
                  border: 'none',
                  padding: '16px 24px',
                  fontFamily: '"Courier New", monospace',
                  fontSize: '11px',
                  letterSpacing: '2.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                SEE THE WORK <ArrowRight size={14} strokeWidth={2.5} />
              </button>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
