import React, { useState, useCallback } from 'react';
import './CustomModal.css';

export const useCustomModal = () => {
    const [modalConfig, setModalConfig] = useState(null);

    const showAlert = useCallback((text, type = 'info', title = null) => {
        setModalConfig({
            type,
            text,
            title,
            isOpen: true
        });
    }, []);

    const showConfirm = useCallback((text, title = null, confirmText = 'Aceptar', cancelText = 'Cancelar') => {
        return new Promise((resolve) => {
            setModalConfig({
                type: 'confirm',
                text,
                title,
                confirmText,
                cancelText,
                isOpen: true,
                onConfirm: () => {
                    setModalConfig(null);
                    resolve(true);
                },
                onCancel: () => {
                    setModalConfig(null);
                    resolve(false);
                }
            });
        });
    }, []);

    const closeModal = useCallback(() => {
        setModalConfig(null);
    }, []);

    const ModalComponent = useCallback(() => {
        if (!modalConfig || !modalConfig.isOpen) return null;

        const { type, text, title, confirmText, cancelText, onConfirm, onCancel } = modalConfig;

        const handleConfirm = () => {
            if (onConfirm) onConfirm();
            else closeModal();
        };

        const handleCancel = () => {
            if (onCancel) onCancel();
            else closeModal();
        };

        return (
            <div className="custom-modal-backdrop" onClick={handleCancel}>
                <div className={`custom-modal-content custom-modal-${type}`} onClick={e => e.stopPropagation()}>
                    <div className="custom-modal-icon">
                        {type === 'success' && <span className="material-symbols-outlined" style={{color: '#34a853'}}>check_circle</span>}
                        {type === 'error' && <span className="material-symbols-outlined" style={{color: '#ef4444'}}>error</span>}
                        {type === 'warning' && <span className="material-symbols-outlined" style={{color: '#ec9213'}}>warning</span>}
                        {type === 'info' && <span className="material-symbols-outlined" style={{color: '#3b82f6'}}>info</span>}
                        {type === 'confirm' && <span className="material-symbols-outlined" style={{color: '#8b5cf6'}}>help</span>}
                    </div>
                    {title && <h3 className="custom-modal-title">{title}</h3>}
                    <p className="custom-modal-text">{text}</p>
                    <div className="custom-modal-actions">
                        {type === 'confirm' ? (
                            <>
                                <button className="custom-modal-btn cancel" onClick={handleCancel}>{cancelText || 'Cancelar'}</button>
                                <button className="custom-modal-btn confirm" onClick={handleConfirm}>{confirmText || 'Aceptar'}</button>
                            </>
                        ) : (
                            <button className="custom-modal-btn confirm" onClick={handleConfirm}>{confirmText || 'Aceptar'}</button>
                        )}
                    </div>
                </div>
            </div>
        );
    }, [modalConfig, closeModal]);

    return { showAlert, showConfirm, ModalComponent };
};
