// src/components/AudioRecorder.jsx
import React, { useState, useRef } from 'react';
import { VoiceService } from '../services/apiService';

export default function AudioRecorder({ contexto, onProcesado, onError }) {
    const [grabando, setGrabando] = useState(false);
    const [procesando, setProcesando] = useState(false);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    const iniciarGrabacion = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);

            mediaRecorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data);

            mediaRecorderRef.current.onstop = async () => {
                setProcesando(true);
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                chunksRef.current = []; // Limpiamos

                try {
                    // Llamamos a nuestra clase VoiceService
                    const resultadoIA = await VoiceService.procesarAudio(blob, contexto);
                    onProcesado(resultadoIA); // Devolvemos los datos a la vista que lo llamó
                } catch (error) {
                    if (onError) onError(error);
                } finally {
                    setProcesando(false);
                }
            };

            mediaRecorderRef.current.start();
            setGrabando(true);
        } catch (error) {
            console.error("Permiso de micrófono denegado", error);
        }
    };

    const detenerGrabacion = () => {
        if (mediaRecorderRef.current && grabando) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setGrabando(false);
        }
    };

    return (
        <button
            onMouseDown={iniciarGrabacion}
            onMouseUp={detenerGrabacion}
            onTouchStart={iniciarGrabacion} // Para móviles
            onTouchEnd={detenerGrabacion}
            disabled={procesando}
            className={`flex items-center gap-2 p-3 rounded-full text-white font-bold transition-all ${grabando ? 'bg-red-500 animate-pulse scale-110' :
                    procesando ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'
                }`}
        >
            <span className="material-symbols-outlined">
                {grabando ? 'mic' : procesando ? 'hourglass_empty' : 'mic_none'}
            </span>
            {grabando ? 'Suelta para enviar...' : procesando ? 'IA Pensando...' : 'Mantén para hablar'}
        </button>
    );
}