const vi = {
  hero: {
    prefix: "baoloc7401 /",
    subtitle_0:
      "Không gian thử nghiệm cho các thuật toán, sự tò mò, và học tập có chủ đích.",
    subtitle_1: "Ý tưởng nửa vời. Bug thì trọn vẹn.",
    subtitle_2: "Nơi O(n) đến để chết và segfault đến để chơi.",
    subtitle_3: "Xây mấy cái này thay vì ra ngoài đi chơi.",
    subtitle_4: "Tài trợ bởi cà phê và sự khủng hoảng hiện sinh.",
    subtitle_5: "404: không tìm thấy cuối tuần năng suất.",
    subtitle_6: "Chạy được trên máy tôi thôi. ¯\\_(ツ)_/¯",
    subtitle_7: "Vận hành bằng Stack Overflow và sự bướng bỉnh.",
    subtitle_8: "Đi nhanh, sửa nhiều, hối hận sau.",
    subtitle_9: "Nghĩa địa của các dự án dở dang.",
  },
  section: {
    count_one: "{{count}} thí nghiệm",
    count_other: "{{count}} thí nghiệm",
    showing: "hiển thị {{count}} / {{total}}",
  },
  filter: {
    title: "bộ lọc",
    rail_label: "BỘ LỌC",
    search_placeholder: "tìm kiếm...",
    all: "tất cả",
    no_results: "không có thí nghiệm nào khớp.",
    clear: "xóa",
    reset: "đặt lại bộ lọc",
    tags_label: "theo nhãn",
    status_label: "theo trạng thái",
    sidebar_label: "thanh bộ lọc",
    expand: "mở bộ lọc",
    collapse: "thu bộ lọc",
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
  card_stop: {
    active: {
      "0": { face: "(づ ◕‿◕ )づ", shout: "MỜI VÀO" },
      "1": { face: "(^▽^)/", shout: "CHÀO BẠN" },
      "2": { face: "(⌐■_■)", shout: "VÀO ĐI" },
      "3": { face: "╰(°▽°)╯", shout: "SẴN SÀNG" },
      "4": { face: "(｡♥‿♥｡)", shout: "TUI ĐÂY" },
      "5": { face: "( ´ ▽ ` )ﾉ", shout: "HÊ LÔ" },
      "6": { face: "(¬‿¬)", shout: "THỬ XEM" },
    },
    wip: {
      "0": { face: "┌( ಠ_ಠ)┘", shout: "KHOAN ĐÃ" },
      "1": { face: "(╯°□°)╯", shout: "CHƯA XONG" },
      "2": { face: "(눈_눈)", shout: "BẬN" },
      "3": { face: "┐(￣ヘ￣)┌", shout: "QUAY LẠI SAU" },
      "4": { face: "ヽ(`Д´)ﾉ", shout: "DỪNG" },
      "5": { face: "(・_・;)", shout: "ĐỢI" },
      "6": { face: "(¬_¬)", shout: "KHÔNG" },
    },
    planned: {
      "0": { face: "( •̀_•́ )", shout: "CHƯA ĐÂU" },
      "1": { face: "( ｰ̀εｰ́ )", shout: "SẮP MÀ" },
      "2": { face: "(¬_¬ )", shout: "KIÊN NHẪN" },
      "3": { face: "(-_- )", shout: "ZZZ" },
      "4": { face: "(￣ω￣;)", shout: "TỪ TỪ" },
      "5": { face: "( ´_ゝ`)", shout: "MƠ TƯỞNG" },
      "6": { face: "(｡-_-｡)", shout: "NGỦ ĐÂY" },
    },
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
    elevator: {
      title: "Lập Lịch Thang Máy",
      description:
        "FCFS, SSTF, SCAN, LOOK, C-SCAN, C-LOOK — xem các thuật toán lập lịch đĩa cưỡi thang máy.",
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
