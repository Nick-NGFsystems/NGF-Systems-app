export type User = {
  id: string
  email: string
  name: string | null
}

export type Client = {
  id: string
  email: string
  name: string
  status: 'LEAD' | 'ACTIVE'
}

export type ClientConfig = {
  id: string
  client_id: string
  page_request: boolean
  page_website: boolean
  page_content: boolean
  page_invoices: boolean
  feature_blog: boolean
  feature_products: boolean
  feature_booking: boolean
  feature_gallery: boolean
  site_url: string | null
  site_repo: string | null
}
