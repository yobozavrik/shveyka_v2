import axios from 'axios';

const KEYCRM_URL = 'https://openapi.keycrm.app/v1';
const KEYCRM_KEY = process.env.KEYCRM_API_KEY;

export interface SyncResult {
  categories: number;
  products: number;
  variants: number;
  errors: string[];
}

export class CatalogSyncService {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async syncAll(): Promise<SyncResult> {
    const result: SyncResult = { categories: 0, products: 0, variants: 0, errors: [] };
    try {
      await this.syncCategories(result);
      await this.syncProducts(result);
      return result;
    } catch (error: any) {
      result.errors.push(`Critical error: ${error.message}`);
      return result;
    }
  }

  private async syncCategories(result: SyncResult) {
    const response = await axios.get(`${KEYCRM_URL}/products/categories`, {
      headers: { Authorization: `Bearer ${KEYCRM_KEY}` }
    });
    const categories = response.data.data || [];
    for (const cat of categories) {
      await this.supabase.from('product_categories').upsert({
        id: cat.id, parent_id: cat.parent_id, name: cat.name, updated_at: new Date().toISOString()
      });
      result.categories++;
    }
  }

  private async syncProducts(result: SyncResult) {
    let page = 1;
    while (true) {
      const response = await axios.get(`${KEYCRM_URL}/products`, {
        params: { limit: 50, page },
        headers: { Authorization: `Bearer ${KEYCRM_KEY}` }
      });
      const products = response.data.data || [];
      if (products.length === 0) break;

      for (const prod of products) {
        // --- МАГИЯ ПАРСИНГА ДНК ---
        const dna = this.extractDNA(prod.name);
        
        // 1. Находим или создаем Базовую модель
        let baseModelId = null;
        if (dna.base_construction) {
          const { data: baseModel } = await this.supabase
            .from('base_models')
            .upsert({ 
              name: dna.base_construction, 
              category_id: prod.category_id 
            }, { onConflict: 'name' })
            .select()
            .single();
          baseModelId = baseModel?.id;
        }

        // 2. Сохраняем/обновляем исполнение (вариацию модели)
        const { data: existing } = await this.supabase.from('product_models').select('id').eq('keycrm_id', prod.id).maybeSingle();
        
        const modelData = {
          name: prod.name,
          keycrm_id: prod.id,
          category_id: prod.category_id,
          base_model_id: baseModelId,
          main_image_url: prod.thumbnail_url,
          gallery_urls: prod.attachments_data || [],
          // Сохраняем разобранные гены
          base_construction: dna.base_construction,
          design_name: dna.design_name,
          fabric_type: dna.fabric_type,
          fabric_color: dna.fabric_color,
          embroidery_info: dna.embroidery_info,
          updated_at: new Date().toISOString()
        };

        let modelId;
        if (existing) {
          modelId = existing.id;
          await this.supabase.from('product_models').update(modelData).eq('id', modelId);
        } else {
          const { data: newM } = await this.supabase.from('product_models').insert({ ...modelData, sku: prod.sku || `KCM-${prod.id}` }).select().single();
          modelId = newM?.id;
        }

        if (modelId) {
          result.products++;
          await this.fetchOffers(prod.id, modelId, result);
        }
      }
      if (page >= response.data.last_page) break;
      page++;
    }
  }

  /**
   * Логика разбора названия товара на составляющие
   */
  private extractDNA(name: string) {
    const designMatch = name.match(/"(.*?)"/);
    const design_name = designMatch ? designMatch[1] : null;
    const base_construction = name.split('"')[0].trim();
    const embroideryMatch = name.match(/\((.*?)\)/);
    const embroidery_info = embroideryMatch ? embroideryMatch[1].replace('вишивка - ', '').trim() : null;

    let remainder = name.replace(base_construction, '').replace(`"${design_name}"`, '').replace(/\(.*?\)/, '').trim();
    const words = remainder.split(' ').filter(w => w.length > 0);
    
    return {
      base_construction,
      design_name,
      fabric_type: words[0] || null,
      fabric_color: words.slice(1).join(' ') || null,
      embroidery_info
    };
  }

  private async fetchOffers(keycrmProductId: number, internalModelId: number, result: SyncResult) {
    const response = await axios.get(`${KEYCRM_URL}/offers`, {
      params: { 'filter[product_id]': keycrmProductId },
      headers: { Authorization: `Bearer ${KEYCRM_KEY}` }
    });
    const offers = response.data.data || [];
    for (const offer of offers) {
      const sizeProp = offer.properties?.find((p: any) => p.name.toLowerCase().includes('размер') || p.name.toLowerCase().includes('розмір'));
      await this.supabase.from('product_variants').upsert({
        id: offer.id,
        product_model_id: internalModelId,
        sku: offer.sku,
        price: offer.price,
        size: sizeProp ? sizeProp.value : null,
        updated_at: new Date().toISOString()
      });
      result.variants++;
    }
  }
}
