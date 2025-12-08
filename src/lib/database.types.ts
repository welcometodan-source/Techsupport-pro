export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      customer_subscriptions: {
        Row: {
          id: string
          user_id: string
          subscription_plan_id: string
          status: 'active' | 'cancelled' | 'expired' | 'pending_payment'
          start_date: string
          end_date: string | null
          auto_renew: boolean
          created_at: string
          vehicle_count: number
          payment_method: string | null
          payment_reference: string | null
          payment_confirmed: boolean
          last_payment_date: string | null
        }
        Insert: {
          id?: string
          user_id: string
          subscription_plan_id: string
          status?: 'active' | 'cancelled' | 'expired' | 'pending_payment'
          start_date?: string
          end_date?: string | null
          auto_renew?: boolean
          created_at?: string
          vehicle_count?: number
          payment_method?: string | null
          payment_reference?: string | null
          payment_confirmed?: boolean
          last_payment_date?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          subscription_plan_id?: string
          status?: 'active' | 'cancelled' | 'expired' | 'pending_payment'
          start_date?: string
          end_date?: string | null
          auto_renew?: boolean
          created_at?: string
          vehicle_count?: number
          payment_method?: string | null
          payment_reference?: string | null
          payment_confirmed?: boolean
          last_payment_date?: string | null
        }
      }
      subscription_plans: {
        Row: {
          id: string
          plan_name: string
          plan_type: string
          billing_cycle: string
          plan_category: string
          price_monthly: number
          visits_per_month: number
          max_vehicles: number
          description: string | null
          features: Json | null
          is_active: boolean
          created_at: string
        }
      }
      [key: string]: any
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
