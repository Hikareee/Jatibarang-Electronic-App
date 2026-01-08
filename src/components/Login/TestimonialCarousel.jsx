import { useState, useEffect } from 'react'

const testimonials = [
  {
    quote: "IBASA sangat mudah dipahami! Kalau kesulitan selalu didampingi. Jadi merasa punya tim IT sendiri",
    author: "Windy",
    company: "PT MOTORINDO SUKSES SEJAHTERA",
    avatar: null
  },
  {
    quote: "Fleksibel diintegrasikan dengan sistem, alur pencatatannya mudah dipahami serta free biaya implementasi dan konsultasi. IBASA Keren!",
    author: "Wahyu Ekorini",
    company: "Direktur Operasional PT. JC Indonesia",
    avatar: null
  },
  {
    quote: "Buat tagihan ke klien jadi bisa otomatis, dan statistik penjualannya asik banget!",
    author: "Mariana R. Afianti",
    company: "Co-Founder Kerjoo",
    avatar: null
  }
]

export default function TestimonialCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="w-full max-w-lg">
      <div className="relative h-64 overflow-hidden">
        {testimonials.map((testimonial, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 h-full flex flex-col justify-center">
              <p className="text-lg italic text-white mb-6">
                "{testimonial.quote}"
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">
                    {testimonial.author.charAt(0)}
                  </span>
                </div>
                <div>
                  <h5 className="font-semibold text-white">{testimonial.author}</h5>
                  <p className="text-sm text-blue-100">{testimonial.company}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-2 mt-6">
        {testimonials.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentIndex
                ? 'bg-white w-8'
                : 'bg-white/50 hover:bg-white/75'
            }`}
            aria-label={`Go to testimonial ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

