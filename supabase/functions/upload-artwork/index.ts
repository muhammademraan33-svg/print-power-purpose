import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { fileName, fileType } = await req.json()

    if (!fileName || !fileType) {
      return new Response(JSON.stringify({ error: 'File name and type required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Generate unique file path
    const filePath = `${Date.now()}-${fileName}`

    // Create signed URL for upload
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('artwork')
      .createSignedUploadUrl(filePath, {
        upsert: false,
      })

    if (uploadError) {
      throw uploadError
    }

    return new Response(
      JSON.stringify({
        uploadUrl: uploadData.signedUrl,
        filePath: filePath,
        publicUrl: `${supabaseUrl}/storage/v1/object/public/artwork/${filePath}`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Upload error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create upload URL' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
