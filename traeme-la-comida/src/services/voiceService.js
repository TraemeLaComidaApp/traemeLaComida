import { fetchApi } from './apiClient';

class VoiceService {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
    }

    async startRecording(onTimeout = null) {
        if (this.isRecording) return;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Check supported types
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
                ? 'audio/webm;codecs=opus' 
                : 'audio/mp4'; // Fallback for Safari

            this.mediaRecorder = new MediaRecorder(stream, { mimeType });
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            console.log("Grabación iniciada con mimeType:", mimeType);

            // Timer de seguridad: 30 segundos (Límite Groq API gratuita)
            this.recordingTimeout = setTimeout(() => {
                if (this.isRecording) {
                    console.log("Límite de 30 segundos alcanzado. Deteniendo automáticamente...");
                    if (onTimeout) onTimeout();
                    else this.stopRecording().catch(console.error);
                }
            }, 30000);

        } catch (error) {
            console.error("Error al iniciar grabación:", error);
            throw error;
        }
    }

    stopRecording() {
        if (this.recordingTimeout) {
            clearTimeout(this.recordingTimeout);
            this.recordingTimeout = null;
        }

        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder || !this.isRecording) {
                return reject("No hay grabación en curso");
            }

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType });
                this.isRecording = false;
                
                // Stop all tracks to release microphone
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
                
                console.log("Grabación detenida. Blob creado:", audioBlob.size, "bytes");
                resolve(audioBlob);
            };

            this.mediaRecorder.stop();
        });
    }

    async transcribe(audioBlob) {
        const formData = new FormData();
        formData.append('file', audioBlob, 'voice_order.webm');

        try {
            const result = await fetchApi('/voice/transcribe', {
                method: 'POST',
                body: formData
            });
            return result.text;
        } catch (error) {
            console.error("Error en transcripción remota:", error);
            throw error;
        }
    }

    async parseOrder(transcript, menuData) {
        // PREPARE MINIMAL MENU CONTEXT FOR LLM (TO SAVE TOKENS AND AVOID CONFUSION)
        const menuContext = menuData.map(cat => ({
            categoria: cat.nombre,
            productos: cat.productos.map(p => ({
                id: p.id,
                nombre: p.nombre,
                descripcion: p.descripcion || p.desc,
                gruposOpciones: p.gruposOpciones?.map(g => ({
                    id: g.id,
                    nombre: g.nombre,
                    opciones: g.opciones?.map(o => ({
                        id: o.id,
                        nombre: o.nombre
                    }))
                }))
            }))
        }));

        try {
            const result = await fetchApi('/voice/parse-order', {
                method: 'POST',
                body: JSON.stringify({ transcript, menuContext })
            });
            return result.items || [];
        } catch (error) {
            console.error("Error in structured voice parsing:", error);
            throw error;
        }
    }
}

export const voiceService = new VoiceService();
