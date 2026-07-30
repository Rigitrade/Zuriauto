"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  CarouselApi,
} from "@/components/ui/carousel";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import Autoplay from "embla-carousel-autoplay";

export default function VehicleCarousel() {
  const vehicles = [
    {
      name: "Skoda Octavia Combi",
      category: "Professional",
      image: "/images/cars/Skoda_Octavia_Combi.webp",
    },
    {
      name: "Mercedes E-Class",
      category: "Premium",
      image: "/images/cars/Mercedes_E_Class.webp",
    },
    {
      name: "Toyota Prius Hybrid",
      category: "Eco-Friendly",
      image: "/images/cars/Toyota_Prius_Hybrid.webp",
    },
    {
      name: "VW Golf",
      category: "Compact",
      image: "/images/cars/VW_Golf.webp",
    },
    {
      name: "Skoda Kodiaq SUV",
      category: "Family",
      image: "/images/cars/Skoda_Kodiaq_SUV.png",
    },
    {
      name: "Tesla Model 3",
      category: "Electric",
      image: "/images/cars/Tesla_Model_3.webp",
    },
  ];

  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  // Create a ref for the autoplay plugin to persist across renders
  const autoplayRef = useRef(
    Autoplay({
      delay: 4000,
      stopOnInteraction: false, // Changed to false to keep autoplay running
      stopOnMouseEnter: false, // Removed stop on mouse hover
    })
  );

  useEffect(() => {
    if (!api) {
      return;
    }

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  const goToSlide = (index: number) => {
    if (api) {
      api.scrollTo(index);
      // Restart autoplay after manual navigation
      autoplayRef.current.reset();
    }
  };

  return (
    <div className="relative mb-8">
      <Carousel
        setApi={setApi}
        plugins={[autoplayRef.current]}
        className="w-full"
        opts={{
          align: "start",
          loop: true,
        }}
      >
        <CarouselContent>
          {vehicles.map((vehicle, index) => (
            <CarouselItem key={index}>
              <div className="relative aspect-[21/9] sm:aspect-[16/7] lg:aspect-[21/9] w-full bg-slate-100 rounded-lg overflow-hidden">
                <div className="relative w-full h-full">
                  <Image
                    src={vehicle.image}
                    alt={vehicle.name}
                    fill
                    className="object-contain transition-all duration-700 ease-in-out"
                  />
                </div>

                {/* Vehicle Info Overlay - Improved for small screens */}
                {/* <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 bg-white/90 backdrop-blur-sm rounded-lg p-2 sm:p-3 lg:p-4 transition-all duration-500 ease-out max-w-[calc(100%-1rem)] sm:max-w-[calc(50%-2rem)]">
                  <h4 className="text-xs sm:text-sm lg:text-base font-medium text-slate-900 transition-all duration-500 truncate">
                    {vehicle.name}
                  </h4>
                  <p className="text-[10px] sm:text-xs lg:text-sm text-slate-600 transition-all duration-500 truncate">
                    {vehicle.category}
                  </p>
                </div> */}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Custom styled navigation arrows */}
        {/* <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-800 border-0 rounded-full p-2 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 h-10 w-10" /> */}
        {/* <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-800 border-0 rounded-full p-2 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 h-10 w-10" /> */}
      </Carousel>

      {/* Custom Dots Indicator */}
      {/* <div className="flex justify-center space-x-2 mt-4">
        {vehicles.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`h-2 rounded-full transition-all duration-500 ease-out ${
              index === current - 1
                ? "bg-slate-800 w-6 shadow-md"
                : "bg-slate-400 hover:bg-slate-600 w-2 hover:w-3"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div> */}

      {/* Vehicle Counter */}
      {/* <div className="text-center mt-2">
        <span className="text-xs text-slate-500 transition-all duration-300">
          {current} / {count}
        </span>
      </div> */}
    </div>
  );
}
