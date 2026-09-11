#!/usr/bin/env node
/**
 * Genera QR del menú de La Mera para imprimir
 * Ejecutar: node scripts/generar-qr.js
 */

import QRCode from 'qrcode';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://jaumina.com.py';
const SLUG = 'lamera';
const URL_MENU = `${BASE_URL}/m/${SLUG}`;

async function generarQR() {
  try {
    console.log(`🔗 Generando QR para: ${URL_MENU}`);

    // QR como SVG (escalable para impresión)
    const qrSVG = await QRCode.toString(URL_MENU, {
      type: 'svg',
      width: 800,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    // QR como PNG (para usar directamente)
    const qrPNG = await QRCode.toDataURL(URL_MENU, {
      width: 1000,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    // Guardar SVG
    const svgPath = join(__dirname, '..', 'public', 'menu-lamera-qr.svg');
    writeFileSync(svgPath, qrSVG);
    console.log(`✅ SVG guardado en: public/menu-lamera-qr.svg`);

    // Guardar PNG (extraer el base64 y convertir a buffer)
    const pngBase64 = qrPNG.replace(/^data:image\/png;base64,/, '');
    const pngBuffer = Buffer.from(pngBase64, 'base64');
    const pngPath = join(__dirname, '..', 'public', 'menu-lamera-qr.png');
    writeFileSync(pngPath, pngBuffer);
    console.log(`✅ PNG guardado en: public/menu-lamera-qr.png`);

    console.log('');
    console.log('📄 Para imprimir:');
    console.log('   - Usar el SVG para mejor calidad');
    console.log('   - Tamaño recomendado: 10x10 cm mínimo');
    console.log('');
    console.log('🌐 El QR apunta a:');
    console.log(`   ${URL_MENU}`);
  } catch (error) {
    console.error('❌ Error generando QR:', error);
    process.exit(1);
  }
}

generarQR();
