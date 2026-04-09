import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { createPaymentIntent } from '../services/apiCliente';
import './StripePaymentModal.css';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51TKFrkASdC4IwfpKOzSSiYxKAaOYB0jLHZzOeSFP2LCzFLTbD46YCmeMebdeo1ugsqNrUMCVQ78LGSsdZb1CCDgQ00jdcKl3fO');

const CheckoutForm = ({ monto, onSuccess, onCancel }) => {
    const stripe = useStripe();
    const elements = useElements();

    const [errorMessage, setErrorMessage] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!stripe || !elements) return;

        setIsProcessing(true);

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                // Return URL not needed here, we do redirect local if_required
            },
            redirect: 'if_required' 
        });

        if (error) {
            setErrorMessage(error.message);
            setIsProcessing(false);
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            setIsProcessing(false);
            onSuccess(); // Completar el pago
        } else {
            setErrorMessage("El pago no ha podido completarse.");
            setIsProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="spm-form">
            <PaymentElement />
            {errorMessage && <div className="spm-error">{errorMessage}</div>}
            <div className="spm-actions">
                <button type="button" onClick={onCancel} disabled={isProcessing} className="spm-btn-cancelar">Cancelar</button>
                <button type="submit" disabled={!stripe || isProcessing} className="spm-btn-pagar">
                    {isProcessing ? 'Procesando...' : `Pagar ${monto.toFixed(2)}€`}
                </button>
            </div>
        </form>
    );
};

export const StripePaymentModal = ({ isOpen, monto, onSuccess, onCancel }) => {
    const [clientSecret, setClientSecret] = useState('');

    useEffect(() => {
        if (isOpen && monto > 0) {
            createPaymentIntent(monto).then(res => {
                if(res?.clientSecret) setClientSecret(res.clientSecret);
            }).catch(e => console.error("Error creating payment intent", e));
        }
    }, [isOpen, monto]);

    if (!isOpen) return null;

    return (
        <div className="spm-overlay">
            <div className="spm-container">
                <h2>Pago Seguro Online</h2>
                {!clientSecret ? (
                     <div className="spm-loading">
                         <span className="material-symbols-outlined spm-icon-spin">autorenew</span>
                         <p>Conectando con Stripe...</p>
                     </div>
                ) : (
                    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                        <CheckoutForm monto={monto} onSuccess={onSuccess} onCancel={() => {
                            setClientSecret('');
                            onCancel();
                        }} />
                    </Elements>
                )}
            </div>
        </div>
    );
};
