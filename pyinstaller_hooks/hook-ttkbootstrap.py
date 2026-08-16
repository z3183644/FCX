from PyInstaller.utils.hooks import collect_data_files


# ttkbootstrap 2.x renders theme icons from packaged font and JSON assets.
datas = collect_data_files("ttkbootstrap")
