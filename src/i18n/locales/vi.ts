const vi = {
  hero: {
    prefix: "baoloc7401 /",
    subtitle:
      "Không gian thử nghiệm cho các thuật toán, sự tò mò, và học tập có chủ đích.",
  },
  section: {
    count_one: "{{count}} thí nghiệm",
    count_other: "{{count}} thí nghiệm",
  },
  footer: {
    github: "github",
    tagline: "xây dựng để học",
  },
  status: {
    active: "LIVE",
    wip: "ĐANG LÀM",
    planned: "DỰ KIẾN",
  },
  aria: {
    theme_light: "Chuyển sang chế độ sáng",
    theme_dark: "Chuyển sang chế độ tối",
    lang_switch: "Đổi ngôn ngữ",
  },
  experiments: {
    chess: {
      title: "Cờ Vua",
      description:
        "Động cơ cờ vua đầy đủ với minimax + cắt tỉa alpha-beta. Chơi Người vs Người, Người vs AI, hoặc xem AI vs AI.",
    },
    "sorting-visualizer": {
      title: "Trực Quan Sắp Xếp",
      description:
        "Xem các thuật toán bubble, merge, quick, và heap sort đua nhau trong thời gian thực.",
    },
    pathfinding: {
      title: "Tìm Đường",
      description:
        "A* và Dijkstra điều hướng mê cung trên lưới tương tác.",
    },
    "binary-tree": {
      title: "Khám Phá Cây Nhị Phân",
      description:
        "Chèn, xóa và duyệt BST với phân tích từng bước có hoạt ảnh.",
    },
    "bloom-filter": {
      title: "Bộ Lọc Bloom",
      description:
        "Kiểm tra thành viên xác suất — trực quan hóa dương tính giả và va chạm hash.",
    },
    "cellular-automata": {
      title: "Tự Động Tế Bào",
      description:
        "Trò chơi cuộc sống của Conway và tự động cơ bản. Sự phức tạp từ quy tắc đơn giản.",
    },
    "fourier-drawing": {
      title: "Vẽ Fourier",
      description:
        "Các vòng epicycle vẽ bất kỳ đường nào bằng phân tích chuỗi Fourier.",
    },
  },
  tags: {
    algorithms: "thuật toán",
    AI: "AI",
    game: "trò chơi",
    visualization: "trực quan",
    graphs: "đồ thị",
    "data structures": "cấu trúc dữ liệu",
    trees: "cây",
    probabilistic: "xác suất",
    simulation: "mô phỏng",
    fun: "vui",
    math: "toán học",
  },
  chess: {
    back: "← thí nghiệm",
    badge: "thí nghiệm 01",
    desc1: "AI Minimax với cắt tỉa alpha-beta và bảng giá trị quân cờ.",
    desc2: "Chọn chế độ để bắt đầu.",
    modes: {
      hvh: "Người vs Người",
      hva: "Người vs AI",
      ava: "AI vs AI",
    },
    puzzle_mode: "Chế Độ Câu Đố",
    planned_tag: "dự kiến",
    promote_to: "Phong cấp thành:",
    white: "Trắng",
    black: "Đen",
    check_badge: "chiếu",
    win_badge: "thắng",
    loss_badge: "thua",
    status: {
      check: "chiếu!",
      black_wins: "đen thắng",
      white_wins: "trắng thắng",
      stalemate: "hòa cờ",
      draw_repetition: "hòa do lặp",
      draw_50move: "hòa 50 nước",
    },
    resume: "▶ Tiếp tục",
    pause: "⏸ Tạm dừng",
    step: "→ Bước",
    reset: "↺ Đặt lại",
    mode_back: "← Chế độ",
    history_title: "Lịch sử nước đi",
    copy: "sao chép",
    copied: "✓ đã sao chép",
    copy_grades: "đánh giá",
    copy_grades_hint: "Kèm ký hiệu đánh giá (!!, !, ?!, ...) khi sao chép",
    no_moves: "Chưa có nước đi.",
    skill: {
      title: "Mức AI",
      white: "AI bên Trắng",
      black: "AI bên Đen",
      start: "Bắt đầu",
      back: "Quay lại",
      beginner: "Mới chơi",
      casual: "Bình thường",
      intermediate: "Trung cấp",
      advanced: "Nâng cao",
      master: "Chuyên gia",
      desc: {
        beginner: "Nhìn trước một nước. Hay đi sai.",
        casual: "Nhìn trước hai nước. Bỏ lỡ nhiều đòn.",
        intermediate: "Trình câu lạc bộ. Bắt được đòn cơ bản.",
        advanced: "Mạnh. Hiếm khi sai, tìm kiếm sâu.",
        master: "Đầy đủ. Không nhiễu, tìm kiếm sâu nhất.",
      },
    },
  },
} as const;

export default vi;
