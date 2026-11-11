import type { Category, Product, Store } from '../types';
import heroBannerImg from '../assets/images/store_hero_banner_1794416631332.jpg';
import vaseImg from '../assets/images/product_ceramic_vase_1794416631324.jpg';
import toteImg from '../assets/images/product_leather_tote_1794416632125.jpg';
import coffeeImg from '../assets/images/product_artisan_coffee_1794416632790.jpg';

export const DEMO_HERO_BANNER = heroBannerImg;

export const DEMO_STORE: Store = {
  id: 'casa-nexo-demo',
  slug: 'casa-nexo-demo',
  name: 'Casa Nexo Concept',
  description:
    'Objetos de diseño, marroquinería artesanal y café de especialidad. Pedidos directos con coordinación por WhatsApp.',
  whatsapp: '5493764000000',
  address: 'Av. Roque Sáenz Peña 1840, Posadas, Misiones',
  hours: 'Lun a Sáb · 09:00 a 13:00 y 16:30 a 20:30',
  bannerUrl: heroBannerImg,
  logoUrl: '',
  appIconUrl: '',
  accentColor: '#0F172A',
  isActive: true,
  ownerUid: 'demo',
  isDemo: true,
};

export const DEMO_CATEGORIES: Category[] = [
  {
    id: 'cat-ceramica',
    storeId: 'casa-nexo-demo',
    ownerUid: 'demo',
    name: 'Cerámica & Hogar',
    description: 'Piezas torneadas a mano en gres esmaltado.',
    order: 1,
    isAvailable: true,
  },
  {
    id: 'cat-accesorios',
    storeId: 'casa-nexo-demo',
    ownerUid: 'demo',
    name: 'Marroquinería',
    description: 'Bolsos y carteras en cuero genuino.',
    order: 2,
    isAvailable: true,
  },
  {
    id: 'cat-cafe',
    storeId: 'casa-nexo-demo',
    ownerUid: 'demo',
    name: 'Café de Especialidad',
    description: 'Granos tostados de origen único.',
    order: 3,
    isAvailable: true,
  },
];

export const DEMO_PRODUCTS: Product[] = [
  {
    id: 'prod-florero-gres',
    storeId: 'casa-nexo-demo',
    ownerUid: 'demo',
    categoryId: 'cat-ceramica',
    name: 'Florero Gres Travertino',
    description:
      'Pieza artesanal en gres chamotado acabado mate natural. Ideal para ramas secas o flores frescas.',
    price: 38500,
    imageUrl: vaseImg,
    isAvailable: true,
    featured: true,
  },
  {
    id: 'prod-tote-cuero',
    storeId: 'casa-nexo-demo',
    ownerUid: 'demo',
    categoryId: 'cat-accesorios',
    name: 'Tote Estructurada Cognac',
    description:
      'Cartera tote confeccionada en cuero vacuno curtido vegetal con herrajes en bronce envejecido y correa desmontable.',
    price: 124000,
    imageUrl: toteImg,
    isAvailable: true,
    featured: true,
  },
  {
    id: 'prod-cafe-etiopia',
    storeId: 'casa-nexo-demo',
    ownerUid: 'demo',
    categoryId: 'cat-cafe',
    name: 'Café Ethiopia Yirgacheffe 250g',
    description:
      'Tueste medio de especialidad con notas florales de jazmín, bergamota y miel. Disponible en grano o molido.',
    price: 21800,
    imageUrl: coffeeImg,
    isAvailable: true,
    featured: false,
  },
];
